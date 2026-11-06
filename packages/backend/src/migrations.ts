import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

/** Applies ordered migrations once per schema, serializing runners with an advisory lock. */
export async function applyMigrations(pool: Pool) {
  const root = fileURLToPath(new URL("../migrations/", import.meta.url));
  const files = (await readdir(root))
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const client = await pool.connect();
  await client.query("SELECT pg_advisory_lock(hashtextextended(current_schema(), 0))");
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of files) {
      const exists = await client.query("SELECT 1 FROM schema_migrations WHERE version=$1", [file]);
      if (exists.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(`${root}${file}`, "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtextextended(current_schema(), 0))");
    client.release();
  }
}
