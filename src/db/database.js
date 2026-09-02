import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool1 = new Pool({
  connectionString: process.env.DATABASE_URL_SHARD1,
});

const pool2 = new Pool({
  connectionString: process.env.DATABASE_URL_SHARD2,
});

export const shard1 = drizzle(pool1);
export const shard2 = drizzle(pool2);