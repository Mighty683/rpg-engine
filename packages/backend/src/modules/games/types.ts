import type { createGamesService } from "./factory.ts";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import type { createGameAccessService } from "./service.ts";

export type GamesService = ReturnType<typeof createGamesService>;

export type GameRow = { id: string; name: string; systemId: string; createdAt: Date };

export type GameActor = { accountId: string; sessionId: string };

export type GameAccess =
  | { role: "GM"; membershipId: null }
  | { role: "Player"; membershipId: string };

export type DatabaseExecutor = Database | DatabaseTransaction;

export type GameAccessRecord = { gmAccountId: string; membershipId: string | null };

/** Reads membership for an account; callers make the authorization decision. */
export interface GameAccessRepository {
  findGameAccess(gameId: string, accountId: string): Promise<GameAccessRecord | null>;
}

export type GameAccessFactory = (
  tx: DatabaseTransaction,
) => ReturnType<typeof createGameAccessService>;
