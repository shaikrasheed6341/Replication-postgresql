import { defineConfig } from "drizzle-kit";
import { configDotenv } from "dotenv";
import "dotenv/config";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dbCredentials: {
    url:process.env.DATABASE_URL_SHARD2
  },
});
