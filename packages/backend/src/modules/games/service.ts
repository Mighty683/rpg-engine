import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
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

export async function listGames(pool: Pool) {
  const result = await pool.query<GameRow>(
    "SELECT id, name, system_id, created_at FROM games WHERE system_id = 'fabula-ultima' ORDER BY created_at DESC, id DESC",
  );
  return result.rows.map(presentGame);
}

export async function getGame(pool: Pool, id: string) {
  const result = await pool.query<GameRow>(
    "SELECT id, name, system_id, created_at FROM games WHERE id = $1 AND system_id = 'fabula-ultima'",
    [id],
  );
  return result.rows[0] ? presentGame(result.rows[0]) : null;
}

export async function createGame(pool: Pool, name: string, systemId: string) {
  const result = await pool.query<GameRow>(
    "INSERT INTO games (id, name, system_id) VALUES ($1, $2, $3) RETURNING id, name, system_id, created_at",
    [randomUUID(), name, systemId],
  );
  return presentGame(result.rows[0]!);
}
