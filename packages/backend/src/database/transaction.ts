import type { PgTransactionConfig } from "drizzle-orm/pg-core";
import type { Database, DatabaseTransaction } from "./client.ts";

/** Dispatches notifications only after commit; notification errors do not undo a committed write. */
export async function transaction<T>(
  database: Database,
  operation: (
    tx: DatabaseTransaction,
    afterCommit: (callback: () => void | Promise<void>) => void,
  ) => Promise<T>,
  config?: PgTransactionConfig,
): Promise<T> {
  const callbacks: (() => void | Promise<void>)[] = [];
  const result = await database.transaction(
    (tx) => operation(tx, (callback) => callbacks.push(callback)),
    config,
  );
  for (const callback of callbacks) await notifyAfterCommit(callback);
  return result;
}

/** Notification failures must not turn an already committed write into a failed response. */
export async function notifyAfterCommit(callback: () => void | Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Post-commit notification failed", error);
  }
}
