import pg from "pg";
import { applyMigrations } from "./migrations.ts";

const connectionString =
  process.env.MIGRATION_DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : process.env.DATABASE_URL);
if (!connectionString)
  throw new Error(
    "MIGRATION_DATABASE_URL is required in production; DATABASE_URL is the development fallback",
  );
const pool = new pg.Pool({ connectionString });
try {
  await applyMigrations(pool);
} finally {
  await pool.end();
}
