import { randomUUID } from "node:crypto";
import type { Database, DatabaseTransaction } from "../../database/client.ts";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { games, players } from "../../database/schema.ts";
import { findSystem } from "../rpg-systems/catalog.ts";

export function validateGame(input: unknown) {
  const value =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const systemId = typeof value.systemId === "string" ? value.systemId : "";
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Enter a game name";
  else if (Array.from(name).length > 20) fields.name = "Use 20 characters or fewer";
  if (!findSystem(systemId)) fields.systemId = "Select an RPG system";
  return { name, systemId, fields };
}

type GameRow = { id: string; name: string; systemId: string; createdAt: Date };

function presentGame(row: GameRow) {
  const system = findSystem(row.systemId);
  if (!system) throw new Error("Saved game references an unknown RPG system");
  return { id: row.id, name: row.name, system, createdAt: row.createdAt.toISOString() };
}

export type GameActor = { accountId: string; sessionId: string };
export type GameAccess =
  | { role: "GM"; membershipId: null }
  | { role: "Player"; membershipId: string };
type DatabaseExecutor = Database | DatabaseTransaction;

export type GameAccessRecord = { gmAccountId: string; membershipId: string | null };

/** Reads membership for an account; callers make the authorization decision. */
export interface GameAccessRepository {
  findGameAccess(gameId: string, accountId: string): Promise<GameAccessRecord | null>;
}

export async function resolveGameAccess(
  repository: GameAccessRepository,
  actor: GameActor,
  gameId: string,
): Promise<GameAccess | null> {
  const entry = await repository.findGameAccess(gameId, actor.accountId);
  if (!entry) return null;
  if (entry.gmAccountId === actor.accountId) return { role: "GM", membershipId: null };
  return entry.membershipId ? { role: "Player", membershipId: entry.membershipId } : null;
}

/** Resolves game authority from current database state, never from request fields. */
export async function gameAccess(
  db: DatabaseExecutor,
  actor: GameActor,
  gameId: string,
): Promise<GameAccess | null> {
  return resolveGameAccess(
    {
      async findGameAccess(id, accountId) {
        const [entry] = await db
          .select({ gmAccountId: games.gmAccountId, membershipId: players.id })
          .from(games)
          .leftJoin(
            players,
            and(
              eq(players.gameId, games.id),
              eq(players.accountId, accountId),
              eq(players.removed, false),
            ),
          )
          .where(and(eq(games.id, id), eq(games.systemId, "fabula-ultima")));
        return entry ?? null;
      },
    },
    actor,
    gameId,
  );
}

/** Serializes mutations and reloads access after acquiring the game lock. */
export async function lockGame(db: DatabaseTransaction, actor: GameActor, gameId: string) {
  await db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).for("update");
  const access = await gameAccess(db, actor, gameId);
  if (!access) throw Object.assign(new Error("not_found"), { code: "not_found" });
  return access;
}

const gameFields = {
  id: games.id,
  name: games.name,
  systemId: games.systemId,
  createdAt: games.createdAt,
};

function actorGames(database: Database, actor: GameActor) {
  return database
    .select({
      ...gameFields,
      role: sql<
        "GM" | "Player"
      >`CASE WHEN ${games.gmAccountId}=${actor.accountId} THEN 'GM' ELSE 'Player' END`,
    })
    .from(games)
    .leftJoin(
      players,
      and(
        eq(players.gameId, games.id),
        eq(players.accountId, actor.accountId),
        eq(players.removed, false),
      ),
    );
}

export async function listActorGames(database: Database, actor: GameActor) {
  const result = await actorGames(database, actor)
    .where(
      and(
        eq(games.systemId, "fabula-ultima"),
        or(eq(games.gmAccountId, actor.accountId), isNotNull(players.id)),
      ),
    )
    .orderBy(desc(games.createdAt), desc(games.id));
  return result.map((entry) => ({ ...presentGame(entry), role: entry.role }));
}

export async function getActorGame(database: Database, actor: GameActor, gameId: string) {
  const [entry] = await actorGames(database, actor).where(
    and(
      eq(games.id, gameId),
      eq(games.systemId, "fabula-ultima"),
      or(eq(games.gmAccountId, actor.accountId), isNotNull(players.id)),
    ),
  );
  return entry ? { ...presentGame(entry), role: entry.role } : null;
}

export async function createActorGame(
  database: Database,
  actor: GameActor,
  name: string,
  systemId: string,
) {
  const [result] = await database
    .insert(games)
    .values({ id: randomUUID(), name, systemId, gmAccountId: actor.accountId })
    .returning(gameFields);
  return { ...presentGame(result!), role: "GM" as const };
}
