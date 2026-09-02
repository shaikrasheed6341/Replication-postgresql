# DBMS Project — Connection Troubleshooting Guide

This document explains every connection error that occurred, which file caused it,
and what was changed to fix it.

---

## Quick Status Check (run these every time you start)

```powershell
# 1. Are containers running?
docker compose ps

# 2. Are ports available?
netstat -ano | findstr ":5433 :5434"

# 3. Do connections work?
node -e "
const {Pool}=require('pg');
const p1=new Pool({host:'127.0.0.1',port:5434,user:'postgres',password:'postgres_password',database:'mydb'});
const p2=new Pool({host:'127.0.0.1',port:5433,user:'postgres',password:'postgres_password',database:'mydb'});
Promise.all([
  p1.connect().then(c=>{console.log('WRITE (primary:5434) OK'); c.release()}).catch(e=>console.error('WRITE FAIL:',e.message)),
  p2.connect().then(c=>{console.log('READ  (replica:5433) OK'); c.release()}).catch(e=>console.error('READ  FAIL:',e.message))
]).then(()=>process.exit(0))
"
```

---

## Port Map (Current Setup)

| Port (host) | Maps to | Container | Role |
|-------------|---------|-----------|------|
| `5432` | — | ❌ Windows PG18 (conflict!) | Avoid this port |
| `5433` | container:5432 | `postgres-replica` | READ (pool2) |
| `5434` | container:5432 | `postgres-primary` | WRITE (pool1) |

> **Important**: Windows PostgreSQL 18 is installed natively and occupies port `5432`.
> Your Docker primary was moved to `5434` to avoid this conflict.

---

## Issue 1 — `no pg_hba.conf entry for host "172.21.0.1"`

### Error message
```
pool2 connect error: no pg_hba.conf entry for host "172.21.0.1",
user "postgres", database "mydb", no encryption
```

### Which file caused it
`replica/replica-entrypoint.sh` — missing `replica/pg_hba.conf`

### Root cause
The replica container had **no custom pg_hba.conf**.
When `pg_basebackup` copies data from the primary, it creates a default pg_hba.conf
that rejects unencrypted connections from external IPs.
`172.21.0.1` is the Docker bridge gateway IP — the IP your Node.js app appears
as inside the container.

### Files changed

**`replica/pg_hba.conf` — CREATED (new file)**
```conf
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               trust
host    replication     replicator      0.0.0.0/0               trust
host    replication     replicator      ::/0                    trust
```

**`replica/replica-entrypoint.sh` — line 24**
```bash
# BEFORE (uses default pg_hba.conf inside PGDATA):
exec su postgres -c "postgres -D '$PGDATA'"

# AFTER (loads our custom pg_hba.conf):
exec su postgres -c "postgres -D '$PGDATA' -c hba_file=/etc/postgresql/pg_hba.conf"
```

**`docker-compose.yml` — replica volumes section**
```yaml
# ADDED this volume mount:
- ./replica/pg_hba.conf:/etc/postgresql/pg_hba.conf
```

---

## Issue 2 — `password authentication failed` (pool1/write) — port conflict

### Error message
```
pool1 (5432/write) connect error: password authentication failed for user "postgres"
```

### Which file caused it
No config file — this was a **Windows system-level port conflict**.

### Root cause
Windows has **PostgreSQL 18 installed natively**, listening on port `5432`.
When Node.js connects to `localhost:5432`, Windows routes it to the native PG18,
NOT to your Docker container. The native PG18 has a different password, so auth fails.

Verify with:
```powershell
netstat -ano | findstr ":5432" | findstr "LISTEN"
# Shows TWO entries:
#   PID 6108  = postgres.exe        (Windows native PostgreSQL 18)
#   PID 16928 = com.docker.backend  (Docker proxy — the real container)
```

### Files changed

**`.env`**
```env
# BEFORE:
DATABASE_URL_WRITE=postgresql://postgres:postgres_password@localhost:5432/mydb

# AFTER:
DATABASE_URL_WRITE=postgresql://postgres:postgres_password@localhost:5434/mydb
```

**`docker-compose.yml`**
```yaml
# BEFORE:
ports:
  - "5432:5432"   # conflicts with Windows PG18

# AFTER:
ports:
  - "5434:5432"   # safe port, no conflicts
```

---

## Issue 3 — `password authentication failed` (scram-sha-256 on Windows)

### Error message
```
password authentication failed for user "postgres"
pg error code: 28P01
```

### Which file caused it
`primary/pg_hba.conf`

### Root cause
PostgreSQL 16 stores passwords as `scram-sha-256` by default.
On **Windows Docker Desktop**, the TCP proxy mangles the password handshake
for host-to-container connections. Auth always fails from the host, even with
the correct password.

The fix is `trust` auth (no password challenge), which is safe for local dev.

### File changed

**`primary/pg_hba.conf`**
```conf
# BEFORE (md5 — fails on Windows Docker Desktop):
host    all    all    0.0.0.0/0    md5

# AFTER (trust — safe for local dev):
host    all    all    0.0.0.0/0    trust
```

---

## Issue 4 — App still shows old errors after `.env` change

### Cause
`nodemon` was already running and cached the old environment variables.
A file save does NOT reload `.env` — you must **restart nodemon**.

### Fix
Stop `npm run dev` with **Ctrl+C**, then:
```powershell
npm run dev
```

---

## All Files Modified (Summary)

| File | What Changed |
|------|-------------|
| `.env` | Write URL port: `5432` → `5434` |
| `docker-compose.yml` | Primary host port: `5432` → `5434`; added replica pg_hba.conf volume mount |
| `primary/pg_hba.conf` | Auth method: `md5` → `trust` for all external hosts |
| `primary/init.sql` | Added `ALTER USER postgres` to ensure password is always set on fresh init |
| `replica/pg_hba.conf` | **New file** — trust auth for all external hosts |
| `replica/replica-entrypoint.sh` | Added `-c hba_file=...` so replica loads our custom pg_hba.conf |
| `src/db/database.js` | Fixed mislabelled log: `pool1 (5433)` → `pool1 (5432/write)` |

---

## How to Start Fresh (if something breaks)

```powershell
# 1. Stop the app (Ctrl+C in npm run dev terminal)

# 2. Destroy and recreate all containers + volumes
docker compose down -v
docker compose up -d

# 3. Wait 15 seconds for replica pg_basebackup to finish

# 4. Start the app
npm run dev
```

---

## Windows PostgreSQL 18 Service

Your machine has a native Windows PG18 running permanently on port 5432.
It does not interfere now (Docker uses 5434 instead).

To disable it permanently (optional — run in **Admin PowerShell**):
```powershell
Stop-Service postgresql-x64-18 -Force
Set-Service postgresql-x64-18 -StartupType Disabled
```
This would free port 5432 and let you use it for Docker again if you wish.
