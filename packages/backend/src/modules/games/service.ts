import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
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

type GameRow = { id: string; name: string; system_id: string; created_at: Date };

function presentGame(row: GameRow) {
  const system = findSystem(row.system_id);
  if (!system) throw new Error("Saved game references an unknown RPG system");
  return { id: row.id, name: row.name, system, createdAt: row.created_at.toISOString() };
}

export type GameActor = { accountId: string; sessionId: string };
export type GameAccess =
  | { role: "GM"; membershipId: null }
  | { role: "Player"; membershipId: string };
type Database = Pool | PoolClient;

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
  db: Database,
  actor: GameActor,
  gameId: string,
): Promise<GameAccess | null> {
  return resolveGameAccess(
    {
      async findGameAccess(id, accountId) {
        const result = await db.query<{ gm_account_id: string; membership_id: string | null }>(
          `SELECT g.gm_account_id, p.id AS membership_id FROM games g
         LEFT JOIN players p ON p.game_id=g.id AND p.account_id=$2 AND NOT p.removed
         WHERE g.id=$1 AND g.system_id='fabula-ultima'`,
          [id, accountId],
        );
        const entry = result.rows[0];
        return entry
          ? { gmAccountId: entry.gm_account_id, membershipId: entry.membership_id }
          : null;
      },
    },
    actor,
    gameId,
  );
}

/** Serializes mutations and reloads access after acquiring the game lock. */
export async function lockGame(db: PoolClient, actor: GameActor, gameId: string) {
  await db.query("SELECT id FROM games WHERE id=$1 FOR UPDATE", [gameId]);
  const access = await gameAccess(db, actor, gameId);
  if (!access) throw Object.assign(new Error("not_found"), { code: "not_found" });
  return access;
}

export async function listActorGames(pool: Pool, actor: GameActor) {
  const result = await pool.query<GameRow & { role: "GM" | "Player" }>(
    `SELECT g.id,g.name,g.system_id,g.created_at,
      CASE WHEN g.gm_account_id=$1 THEN 'GM' ELSE 'Player' END AS role
     FROM games g LEFT JOIN players p ON p.game_id=g.id AND p.account_id=$1 AND NOT p.removed
     WHERE g.system_id='fabula-ultima' AND (g.gm_account_id=$1 OR p.id IS NOT NULL)
     ORDER BY g.created_at DESC,g.id DESC`,
    [actor.accountId],
  );
  return result.rows.map((entry) => ({ ...presentGame(entry), role: entry.role }));
}

export async function getActorGame(pool: Pool, actor: GameActor, gameId: string) {
  const games = await pool.query<GameRow & { role: "GM" | "Player" }>(
    `SELECT g.id,g.name,g.system_id,g.created_at,
      CASE WHEN g.gm_account_id=$2 THEN 'GM' ELSE 'Player' END AS role
     FROM games g LEFT JOIN players p ON p.game_id=g.id AND p.account_id=$2 AND NOT p.removed
     WHERE g.id=$1 AND g.system_id='fabula-ultima' AND (g.gm_account_id=$2 OR p.id IS NOT NULL)`,
    [gameId, actor.accountId],
  );
  const entry = games.rows[0];
  return entry ? { ...presentGame(entry), role: entry.role } : null;
}

export async function createActorGame(
  pool: Pool,
  actor: GameActor,
  name: string,
  systemId: string,
) {
  const result = await pool.query<GameRow>(
    "INSERT INTO games (id,name,system_id,gm_account_id) VALUES ($1,$2,$3,$4) RETURNING id,name,system_id,created_at",
    [randomUUID(), name, systemId, actor.accountId],
  );
  return { ...presentGame(result.rows[0]!), role: "GM" as const };
}
