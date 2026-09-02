# PostgreSQL Docker Streaming Replication — Revision Notes

This document converts the original notes into a concise, teachable Markdown guide for learning physical streaming replication between two PostgreSQL Docker containers (primary/write and physical standby/read). It includes explanations of why each configuration and step matters.

## Goal

Configure PostgreSQL physical streaming replication using two Docker containers so that:

- WRITE DB / PRIMARY handles INSERT/UPDATE/DELETE (writes)
- READ DB / REPLICA handles SELECTs (reads)
- PostgreSQL sends WAL (Write-Ahead Log) changes from the primary to the replica and the replica replays them

## Final Architecture (logical)

```
                  PostgreSQL WAL
                       |
                       v
               +---------------+
               |   WRITE DB    |
               |    PRIMARY    |
               |  172.17.0.3   |
               +-------+-------+
                       |
                       | Streaming Replication (WAL)
                       |
                       v
               +---------------+
               |    READ DB    |
               |    REPLICA    |
               |  172.17.0.2   |
               +---------------+
```

Application flow summary:
- Write ops -> WRITE DB -> WAL -> READ DB (replayed)
- Read ops -> READ DB

## Key PostgreSQL Concepts

- WAL (Write-Ahead Log): the append-only change log. Every change that modifies data is first written to WAL; replicas receive WAL and replay it.
- Physical (base) replication: copies block-level state and replays WAL; replica cannot accept writes (except in special configurations).
- Replication role: a PostgreSQL role with `REPLICATION` privilege used by replicas to connect to the primary.

Why this matters: WAL-forwarding is the core mechanism that keeps a standby consistent with the primary. Understanding WAL helps diagnose lag, storage pressure, and recovery behavior.

## Primary vs Replica (roles)

- Write DB (Primary): accepts writes, produces WAL data, exposes WAL streaming endpoints.
- Read DB (Replica / Standby): connects to primary, receives WAL and replays it, exposes read-only state.

Why: separating reads and writes improves read scalability and isolates destructive operations (migrations, maintenance) to the primary.

## Important postgresql.conf Settings (on PRIMARY)

- `wal_level = replica`
  - Enables the extra WAL information required for physical replication.
  - Why: without this, the primary won't produce WAL sufficient for standbys.

- `max_wal_senders = 10`
  - Number of concurrent WAL sender processes (how many standbys or tools can stream WAL).
  - Why: set high enough for your number of replicas and backup tools.

- `wal_keep_size = 512MB` (example)
  - Keep a minimum amount of WAL files to help short-lived replicas catch up without requesting WAL from archive.
  - Why: prevents replicas falling so far behind they need a base backup.

- `listen_addresses = '*'`
  - Allow PostgreSQL to accept connections from other containers/hosts.
  - Why: required for the replica to connect; authentication still enforced via `pg_hba.conf`.

Always restart PostgreSQL after changes.

## postgresql.conf vs pg_hba.conf

- `postgresql.conf`: runtime server settings (WAL level, senders, listen addresses, checkpointing, etc.).
- `pg_hba.conf`: client authentication and who can connect (host, user, database, auth method).

Why: replication requires both—the server to produce WAL and the host/auth rules to allow the replica connection.

## Finding configuration files inside the container

Run inside the container:

```
SHOW config_file;
```

Typical data directory in Docker: `/var/lib/postgresql/data`

Files to edit:
- `/var/lib/postgresql/data/postgresql.conf`
- `/var/lib/postgresql/data/pg_hba.conf`

## Editing files inside a Debian-based container

If `vi` is missing, install `nano`:

```bash
apt update
apt install -y nano
nano /var/lib/postgresql/data/postgresql.conf
```

Nano shortcuts: `Ctrl+W` (search), `Ctrl+O` (save), `Ctrl+X` (exit).

Why: containers are minimal; editing in-place is often the fastest way to tweak config during experiments.

## Create the replication role (on PRIMARY)

Example:

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'STRONG_PASSWORD';
```

Requirements:
- `LOGIN` so clients can authenticate
- `REPLICATION` so the role can start replication connections

Why: the replica connects over the network and needs a role with proper privileges.

## pg_hba.conf: allow the replica to authenticate (on PRIMARY)

Add a replication line permitting the replica's IP:

```
host    replication    replicator    172.17.0.2/32    scram-sha-256
```

Why: authentication is enforced on the primary because replicas initiate connections to the primary. Use `scram-sha-256` for better security.

## Finding Docker container IPs (quick)

```
docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" read-db
```

Note: container IPs may change on recreation. For reliability, use a user-defined Docker network and service/container names.

Why: you need the replica's IP in `pg_hba.conf` and the primary's IP when running `pg_basebackup`.

## Test network connectivity (from REPLICA container)

```
pg_isready -h 172.17.0.3 -p 5432
# => "172.17.0.3:5432 - accepting connections"
```

Why: verifies TCP reachability and that PostgreSQL accepts connections.

## Test the replication user (from REPLICA)

```
psql -h 172.17.0.3 -U replicator -d postgres
```

Why: verifies credentials and auth method are correct.

## Why `pg_basebackup` is required

Two independent PostgreSQL containers are not automatically a primary/replica pair. A replica needs a base copy of the primary's data directory to start from—the same cluster state. `pg_basebackup` copies the cluster files and optionally streams WAL.

Why: without a base backup, the replica has no starting point and can't replay WAL.

## Running `pg_basebackup` (on the REPLICA container)

Example command (runs from the standby container):

```bash
pg_basebackup \
  -h 172.17.0.3 \
  -p 5432 \
  -U replicator \
  -D /var/lib/postgresql/data \
  -Fp -Xs -P -R
```

Key options:
- `-D`: destination data directory
- `-Fp`: plain format
- `-Xs`: stream WAL during backup
- `-P`: show progress
- `-R`: create `standby.signal` / recovery config so the copy is ready as a standby

Why: `-R` avoids manual creation of recovery configuration; `-Xs` ensures a consistent backup with streamed WAL.

## Docker volumes and data directory

Confirm the read replica's volume with:

```
docker inspect read-db --format "{{json .Mounts}}"
```

Why: verifying and wiping the volume before base backup prevents stale cluster files from breaking startup.

## Starting and stopping containers (use Docker)

```
docker stop read-db
docker start read-db
docker restart write-db
```

Why: managing the container lifecycle via Docker avoids permission issues from manually running `pg_ctl` as root.

## Common errors and notes

- `pg_ctl: cannot be run as root` — PostgreSQL expects to run as the `postgres` OS user.
- `pg_ctl: command not found` — PATH and environment may not include PostgreSQL binaries after switching users.

Docker tip: start/stop containers instead of running `pg_ctl` inside the container unless you know user contexts.

## Start the read replica

After `pg_basebackup` completes and the data directory is initialized, start the replica container:

```
docker start read-db
```

## Verify standby/recovery mode (on REPLICA)

```sql
SELECT pg_is_in_recovery(); -- returns true (t)
```

Why: `true` indicates the server is running as a standby and not as a standalone writable instance.

## Verify WAL receiver (on REPLICA)

```sql
SELECT status, sender_host, sender_port, latest_end_lsn, latest_end_time
FROM pg_stat_wal_receiver;
```

`status = streaming` means the replica is actively receiving WAL from the primary.

Why: confirms the transport layer and authentication worked; streaming means real-time replication.

## Compare WAL positions

- On PRIMARY:

```sql
SELECT pg_current_wal_lsn();
```

- On REPLICA:

```sql
SELECT pg_last_wal_replay_lsn();
```

If positions are equal (or near), the replica is caught up.

Why: matching LSNs is a direct verification that WAL has been received and replayed.

## Final replication test (schema/DDL replication)

On PRIMARY:

```sql
CREATE TABLE replication_test (
  id SERIAL PRIMARY KEY,
  message TEXT
);
```

Then on REPLICA check tables:

```
\dt
```

If `replication_test` appears, DDL changes have been replicated via WAL.

Why: ensures WAL contains DDL and the standby applied it.

## Errors encountered (from the original run) and fixes

- `vi` not found: installed `nano`.
- `FATAL: role "postgres" does not exist`: cluster's superuser was `shaik`, so use `psql -U shaik`.
- Typo: `postgress` vs `postgres`.
- `pg_last_wal_replay_timestamp()` not available: use `pg_last_wal_replay_lsn()` if timestamp function missing.

Why: container images and cluster setups vary; always confirm available roles and functions.

## Useful commands cheat sheet

Docker

```bash
docker ps
docker exec -it read-db bash
docker exec -it write-db bash
docker start read-db
docker stop read-db
docker restart write-db
```

PostgreSQL (inside `psql`)

```sql
\l      -- list databases
\dt     -- list tables
\q      -- quit psql
SELECT pg_is_in_recovery();
SELECT * FROM pg_stat_wal_receiver;
SELECT pg_last_wal_replay_lsn();
SELECT pg_current_wal_lsn();
```

## Production improvements & recommendations

- Use a user-defined Docker network and DNS names (stable service names) instead of container IPs.
- Use strong passwords and secrets management.
- Prefer `scram-sha-256` authentication.
- Monitor replication lag and WAL disk usage.
- Consider replication slots for durable WAL retention per-replica.
- Regular backups and a documented failover plan.
- Run schema migrations on the primary only; do not apply DDL directly on replicas.

Why: production systems have stricter reliability, security, and observability needs than experiments.

## Application architecture guidance

- Route write operations (POST/PUT/DELETE) to the primary.
- Route read operations (GET) to the replica(s) where appropriate.
- Beware of replication lag — reads immediately after writes may not reflect the latest data.

Why: separating reads/writes improves scalability but adds complexity around data freshness.

## Important migration rule

Always run migrations against the primary. Schema changes are shipped via WAL to physical standbys. Do not independently create tables on replicas.

## Final checklist (verify before declaring replication healthy)

- [ ] `wal_level = replica`
- [ ] `max_wal_senders` configured
- [ ] `wal_keep_size` configured appropriately
- [ ] `listen_addresses` configured
- [ ] replication role created on primary
- [ ] primary `pg_hba.conf` allows replica
- [ ] replica can reach primary (network)
- [ ] `pg_basebackup` completed successfully
- [ ] read DB starts successfully
- [ ] `pg_is_in_recovery() = true`
- [ ] `pg_stat_wal_receiver.status = streaming`
- [ ] WAL positions are progressing
- [ ] Test table created on primary
- [ ] Test table appears on replica

## Next steps and learning exercises

- Convert this guide into a reproducible `docker-compose.yml` with a user-defined network and persistent volumes.
- Automate base backups and testing of replication lag.
- Add monitoring (Prometheus + PostgreSQL exporter) and alerting for replication lag and WAL volume.

---

This document is intended for learning and repeatable experimentation. If you want, I can:

- Commit this file to the repo and open a PR,
- Create a `docker-compose.yml` example that implements the architecture,
- Or convert this into a short README or slides for a presentation.
