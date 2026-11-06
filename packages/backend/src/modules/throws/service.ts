// Game Table throw history: immutable roll snapshots with server-assigned per-game
// sequence and authorship-based removal. Every write
// takes the per-game transaction lock before resolving access, so stale selections
// and revoked memberships are re-checked against current state.
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { serverDieSource, type DieSource } from "../fabula/rolls.ts";
import { gameAccess, lockGame, type GameActor, type GameAccess } from "../games/service.ts";
import { publishGameEvent } from "../events/streams.ts";
import { sheetSequential, type Row } from "../characters/service.ts";
import { fail, gmActorId, type CreateThrowInput, type ThrowRecord, type ResolvedSetup, type OutcomeJson, type ThrowKind } from "./contract.ts";
import { resolveThrow, type ResolutionContext, type RollCharacter, type SourceThrow } from "./resolve.ts";

type ThrowRow = {
  id: string;
  game_id: string;
  seq: string | number;
  created_at: Date;
  author_account_id: string;
  role: "GM" | "Player";
  character_id: string | null;
  equipment_id: string | null;
  character_name: string;
  equipment_name: string | null;
  kind: ThrowKind;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
  deleted: boolean;
};

const present = (row: ThrowRow, actor: GameActor, access: GameAccess): ThrowRecord => ({
  id: row.id,
  seq: Number(row.seq),
  createdAt: row.created_at.toISOString(),
  kind: row.kind,
  role: row.role,
  characterId: row.character_id,
  characterName: row.character_name,
  equipmentId: row.equipment_id,
  equipmentName: row.equipment_name,
  setup: row.setup,
  outcome: row.outcome,
  canRemove: access.role === "GM" || row.author_account_id === actor.accountId,
});

async function readTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function writeTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const activeSql = `SELECT c.id FROM characters c LEFT JOIN players p ON p.id=c.player_id AND p.game_id=c.game_id
  WHERE c.game_id=$1 AND (CASE WHEN c.player_id IS NULL THEN c.gm_active ELSE COALESCE(p.active_character_id=c.id, false) END)`;

async function activeCharacterIds(client: PoolClient, gameId: string) {
  const result = await client.query<{ id: string }>(activeSql, [gameId]);
  return result.rows.map((row) => row.id);
}

async function ownActiveCharacterId(client: PoolClient, gameId: string, membershipId: string) {
  const result = await client.query<{ active_character_id: string | null }>(
    "SELECT active_character_id FROM players WHERE id=$1 AND game_id=$2 AND NOT removed",
    [membershipId, gameId],
  );
  return result.rows[0]?.active_character_id ?? null;
}

async function loadCharacter(client: PoolClient, gameId: string, characterId: string): Promise<RollCharacter | null> {
  const result = await client.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2", [gameId, characterId]);
  const row = result.rows[0];
  if (!row) return null;
  const sheet = await sheetSequential(client, row);
  return { id: row.id, playerId: row.player_id, revision: row.revision, name: sheet.name, sheet };
}

async function loadSource(client: PoolClient, gameId: string, throwId: string): Promise<SourceThrow | null> {
  const result = await client.query<ThrowRow>("SELECT * FROM throws WHERE game_id=$1 AND id=$2 AND NOT deleted", [gameId, throwId]);
  const row = result.rows[0];
  if (!row) return null;
  return { kind: row.kind, setup: row.setup, characterId: row.character_id, equipmentId: row.equipment_id };
}

/** Ordered history read: exclusive sequence cursor, ascending result, live rows only. */
export async function listThrows(pool: Pool, actor: GameActor, gameId: string, before: number | null, limit: number) {
  return readTransaction(pool, async (client) => {
    const access = await lockGameRead(client, actor, gameId);
    const result = await client.query<ThrowRow>(
      `SELECT * FROM throws WHERE game_id=$1 AND NOT deleted AND ($2::bigint IS NULL OR seq < $2) ORDER BY seq DESC LIMIT $3`,
      [gameId, before, limit],
    );
    return { throws: result.rows.reverse().map((row) => present(row, actor, access)) };
  });
}

async function lockGameRead(client: PoolClient, actor: GameActor, gameId: string) {
  const access = await gameAccess(client, actor, gameId);
  if (!access) throw fail("not_found");
  return access;
}

export async function createThrow(pool: Pool, actor: GameActor, gameId: string, input: CreateThrowInput, dieSource: DieSource = serverDieSource) {
  const result = await writeTransaction(pool, async (client) => {
    const access = await lockGame(client, actor, gameId);
    const context = await buildContext(client, gameId, access, input);
    const resolved = resolveThrow(input, context, dieSource);
    const sequence = await client.query<{ next: string | number }>(
      "SELECT COALESCE(MAX(seq),0)+1 AS next FROM throws WHERE game_id=$1",
      [gameId],
    );
    const id = randomUUID();
    const inserted = await client.query<ThrowRow>(
      `INSERT INTO throws (id,game_id,seq,author_account_id,role,character_id,equipment_id,character_name,equipment_name,kind,setup,outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        id,
        gameId,
        Number(sequence.rows[0]!.next),
        actor.accountId,
        resolved.role,
        resolved.characterId,
        resolved.equipmentId,
        resolved.characterName,
        resolved.equipmentName,
        resolved.kind,
        JSON.stringify(resolved.setup),
        JSON.stringify(resolved.outcome),
      ],
    );
    return { record: present(inserted.rows[0]!, actor, access) };
  });
  publishGameEvent(gameId, { type: "throws" });
  return result;
}

async function buildContext(client: PoolClient, gameId: string, access: GameAccess, input: CreateThrowInput): Promise<ResolutionContext> {
  const active = await activeCharacterIds(client, gameId);
  const ownActive = access.role === "Player" ? await ownActiveCharacterId(client, gameId, access.membershipId) : null;
  const setup = input.setup;
  const characterId = setup.type === "free" && setup.characterId === gmActorId ? null : setup.characterId;
  const character = characterId ? await loadCharacter(client, gameId, characterId) : null;
  const weapon =
    setup.type === "weapon" && character
      ? (character.sheet.equipment.find((entry) => entry.id === setup.equipmentId && entry.kind === "weapon") as Extract<RollCharacter["sheet"]["equipment"][number], { kind: "weapon" }> | undefined) ?? null
      : null;
  const source = input.sourceThrowId ? await loadSource(client, gameId, input.sourceThrowId) : null;
  if (input.sourceThrowId && !source) throw fail("not_found");
  return {
    role: access.role,
    membershipId: access.membershipId,
    activeCharacterIds: active,
    ownActiveCharacterId: ownActive,
    character,
    weapon,
    source,
  };
}

/** Marks a history entry deleted; authorship follows the account even after reassignment. */
export async function removeThrow(pool: Pool, actor: GameActor, gameId: string, throwId: string) {
  const result = await writeTransaction(pool, async (client) => {
    const access = await lockGame(client, actor, gameId);
    const found = await client.query<ThrowRow>("SELECT * FROM throws WHERE game_id=$1 AND id=$2 FOR UPDATE", [gameId, throwId]);
    const row = found.rows[0];
    if (!row) throw fail("not_found");
    if (row.deleted) return { deleted: true, changed: false };
    if (access.role !== "GM" && row.author_account_id !== actor.accountId) throw fail("forbidden");
    await client.query("UPDATE throws SET deleted=true WHERE id=$1", [throwId]);
    return { deleted: true, changed: true };
  });
  if (result.changed) publishGameEvent(gameId, { type: "throws" });
  return result;
}
