import pg from "pg";
import type { DatabaseTimeouts } from "./types.ts";

/** Server-side deadlines cancel SQL rather than abandoning a still-running client query. */
export function createRuntimePool(connectionString: string, timeouts: DatabaseTimeouts) {
  return new pg.Pool({
    connectionString,
    connectionTimeoutMillis: timeouts.connectionMs,
    statement_timeout: timeouts.statementMs,
    lock_timeout: timeouts.lockMs,
    idle_in_transaction_session_timeout: timeouts.idleTransactionMs,
  });
}
