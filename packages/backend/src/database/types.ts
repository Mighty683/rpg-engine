import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type Database = NodePgDatabase<Record<string, never>>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type DatabaseTimeouts = {
  connectionMs: number;
  statementMs: number;
  lockMs: number;
  idleTransactionMs: number;
};
