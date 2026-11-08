import { sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

/** Applies ordered migrations once per schema, serializing runners with an advisory lock. */
export async function applyMigrations(pool: Pool) {
  const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    const schemaResult = await drizzle(client).execute<{ schema: string }>(
      sql`SELECT current_schema() AS schema`,
    );
    const migrationsSchema = schemaResult.rows[0]?.schema;
    if (!migrationsSchema) throw new Error("The database session has no active schema");
    await drizzle(client).execute(
      sql`SELECT pg_advisory_lock(hashtextextended(current_schema(), 0))`,
    );
    lockAcquired = true;
    await migrate(drizzle(client), {
      migrationsFolder,
      migrationsSchema,
      migrationsTable: "__drizzle_migrations",
    });
  } finally {
    try {
      if (lockAcquired)
        await drizzle(client).execute(
          sql`SELECT pg_advisory_unlock(hashtextextended(current_schema(), 0))`,
        );
    } finally {
      client.release();
    }
  }
}
