import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

/** Drizzle owns query execution; pg is limited to pool lifecycle at the application boundary. */
export type Database = NodePgDatabase<Record<string, never>>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export function databaseFromPool(pool: Pool): Database {
  return drizzle(pool);
}
