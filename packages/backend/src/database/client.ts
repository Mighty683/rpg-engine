import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { Database } from "./types.ts";

/** Drizzle owns query execution; pg is limited to pool lifecycle at the application boundary. */
export function databaseFromPool(pool: Pool): Database {
  return drizzle(pool);
}
