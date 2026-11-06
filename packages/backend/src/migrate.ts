import pg from "pg";
import { applyMigrations } from "./migrations.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await applyMigrations(pool);
} finally {
  await pool.end();
}
