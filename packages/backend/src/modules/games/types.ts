import type { ApiSchema } from "@rpg-engine/api-schema";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import type { ValidationFields } from "../../shared/validation/types.ts";

export type CreateGameInput = { name: string; systemId: string };
export type GameValidation = CreateGameInput & { fields: ValidationFields };

type GameRecord = ApiSchema["Game"];
export interface GamesService {
  gameAccess(actor: GameActor, gameId: string): Promise<GameAccess | null>;
  createActorGame(actor: GameActor, name: string, systemId: string): Promise<GameRecord>;
  getActorGame(actor: GameActor, gameId: string): Promise<GameRecord | null>;
  listActorGames(actor: GameActor): Promise<GameRecord[]>;
}

export type GameRow = { id: string; name: string; systemId: string; createdAt: Date };

export type GameActor = { accountId: string; sessionId: string };

export type GameAccess =
  | { role: "GM"; membershipId: null }
  | { role: "Player"; membershipId: string };

export type DatabaseExecutor = Database | DatabaseTransaction;

type GameAccessRecord = { gmAccountId: string; membershipId: string | null };

/** Reads membership for an account; callers make the authorization decision. */
export interface GameAccessRepository {
  findGameAccess(gameId: string, accountId: string): Promise<GameAccessRecord | null>;
}

export interface GameAccessService {
  gameAccess(actor: GameActor, gameId: string): Promise<GameAccess | null>;
  lockGame(actor: GameActor, gameId: string): Promise<GameAccess>;
}
export type GameAccessFactory = (tx: DatabaseTransaction) => GameAccessService;
