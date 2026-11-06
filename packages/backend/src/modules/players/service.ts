import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

type PlayerRow = {
  id: string;
  game_id: string;
  name: string;
  active_character_id: string | null;
  active_character_name?: string | null;
  revision: number;
  created_at: Date;
};
const present = (row: PlayerRow) => ({
  id: row.id,
  gameId: row.game_id,
  name: row.name,
  createdAt: row.created_at.toISOString(),
  revision: row.revision,
  activeCharacter: row.active_character_id
    ? { id: row.active_character_id, name: row.active_character_name ?? "" }
    : null,
});

export async function listPlayers(pool: Pool, gameId: string) {
  const result = await pool.query<PlayerRow>(
    `SELECT p.id,p.game_id,p.name,p.active_character_id,p.revision,p.created_at,c.name active_character_name FROM players p JOIN games g ON g.id=p.game_id LEFT JOIN characters c ON c.id=p.active_character_id WHERE p.game_id=$1 AND g.system_id='fabula-ultima' ORDER BY p.created_at ASC,p.id ASC`,
    [gameId],
  );
  return result.rows.map(present);
}
export async function getPlayer(pool: Pool, gameId: string, playerId: string) {
  const result = await pool.query<PlayerRow>(
    `SELECT p.id,p.game_id,p.name,p.active_character_id,p.revision,p.created_at,c.name active_character_name FROM players p JOIN games g ON g.id=p.game_id LEFT JOIN characters c ON c.id=p.active_character_id WHERE p.game_id=$1 AND p.id=$2 AND g.system_id='fabula-ultima'`,
    [gameId, playerId],
  );
  return result.rows[0] ? present(result.rows[0]) : null;
}
export async function createPlayer(pool: Pool, gameId: string, id: string, name: string) {
  const result = await pool.query<PlayerRow & { created: boolean }>(
    `INSERT INTO players(id,game_id,name) VALUES($1,$2,$3) ON CONFLICT (id) DO UPDATE SET id=players.id RETURNING id,game_id,name,active_character_id,revision,created_at,(xmax = 0) AS created`,
    [id || randomUUID(), gameId, name],
  );
  const row = result.rows[0]!;
  if (row.game_id !== gameId)
    throw Object.assign(new Error("id_conflict"), { code: "id_conflict" });
  const joined = await pool.query<PlayerRow>(
    `SELECT p.id,p.game_id,p.name,p.active_character_id,p.revision,p.created_at,c.name active_character_name FROM players p LEFT JOIN characters c ON c.id=p.active_character_id WHERE p.id=$1`,
    [row.id],
  );
  return { record: present(joined.rows[0]!), created: row.created };
}
export async function selectActive(
  pool: Pool,
  gameId: string,
  playerId: string,
  expectedRevision: number,
  characterId: string | null,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const check = await client.query<{ revision: number }>(
      "SELECT revision FROM players WHERE id=$1 AND game_id=$2 FOR UPDATE",
      [playerId, gameId],
    );
    if (!check.rows[0]) return null;
    if (check.rows[0].revision !== expectedRevision)
      throw Object.assign(new Error("stale_revision"), { code: "stale_revision" });
    if (characterId) {
      const c = await client.query("SELECT id FROM characters WHERE id=$1 AND player_id=$2", [
        characterId,
        playerId,
      ]);
      if (!c.rows[0]) throw Object.assign(new Error("not_found"), { code: "not_found" });
    }
    const current = await client.query<{ active_character_id: string | null }>(
      "SELECT active_character_id FROM players WHERE id=$1",
      [playerId],
    );
    if (current.rows[0]!.active_character_id === characterId) {
      const same = await client.query<PlayerRow>(
        `SELECT p.id,p.game_id,p.name,p.active_character_id,p.revision,p.created_at,c.name active_character_name FROM players p LEFT JOIN characters c ON c.id=p.active_character_id WHERE p.id=$1`,
        [playerId],
      );
      await client.query("COMMIT");
      return present(same.rows[0]!);
    }
    const result = await client.query<PlayerRow>(
      `UPDATE players SET active_character_id=$3,revision=revision+1 WHERE id=$1 AND game_id=$2 RETURNING id,game_id,name,active_character_id,revision,created_at`,
      [playerId, gameId, characterId],
    );
    const selected = await client.query<PlayerRow>(
      `SELECT p.id,p.game_id,p.name,p.active_character_id,p.revision,p.created_at,c.name active_character_name FROM players p LEFT JOIN characters c ON c.id=p.active_character_id WHERE p.id=$1`,
      [playerId],
    );
    await client.query("COMMIT");
    return present(selected.rows[0] ?? result.rows[0]!);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
