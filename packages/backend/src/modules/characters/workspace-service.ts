import type { Pool, PoolClient } from "pg";
import { defaultSheet, mergeSheet, type FabulaSheet } from "../fabula/rules.ts";
import { gameAccess, lockGame, type GameActor, type GameAccess } from "../games/service.ts";
import { publishGameEvent } from "../events/streams.ts";
import { present, sheetSequential, type Row } from "./service.ts";
import { canEditCharacter } from "./access.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });
type SummaryRow = { id: string; name: string; level: number; player_id: string | null; controller_name: string | null; active: boolean; created_at: Date };
const summary = (row: SummaryRow, access: GameAccess) => ({
  id: row.id, name: row.name, level: row.level, controllerMembershipId: row.player_id,
  controllerName: row.controller_name, canEdit: canEditCharacter(access, row.player_id),
  active: row.active, createdAt: row.created_at.toISOString(),
});
const summarySql = `SELECT c.id,c.name,c.level,c.player_id,c.created_at,a.username AS controller_name,
  CASE WHEN c.player_id IS NULL THEN c.gm_active ELSE COALESCE(p.active_character_id=c.id, false) END AS active
  FROM characters c LEFT JOIN players p ON p.id=c.player_id AND p.game_id=c.game_id
  LEFT JOIN accounts a ON a.id=p.account_id`;

async function requireReadAccess(client: PoolClient, actor: GameActor, gameId: string) {
  const access = await gameAccess(client, actor, gameId);
  if (!access) throw fail("not_found");
  return access;
}

export async function listWorkspaceCharacters(pool: Pool, actor: GameActor, gameId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const access = await requireReadAccess(client, actor, gameId);
    const result = await client.query<SummaryRow>(`${summarySql} WHERE c.game_id=$1 ORDER BY c.created_at,c.id`, [gameId]);
    await client.query("COMMIT");
    return result.rows.map((item) => summary(item, access));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function getWorkspaceCharacter(pool: Pool, actor: GameActor, gameId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const access = await requireReadAccess(client, actor, gameId);
    const result = await client.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2", [gameId, id]);
    const character = result.rows[0];
    if (!character) throw fail("not_found");
    const record = { ...present(character, await sheetSequential(client, character)), canEdit: canEditCharacter(access, character.player_id) };
    await client.query("COMMIT");
    return record;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function createWorkspaceCharacter(pool: Pool, actor: GameActor, gameId: string, id: string, name: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await lockGame(client, actor, gameId);
    const sheet = defaultSheet(name);
    const receipt = await client.query<{ game_id: string; character_id: string; name: string }>(
      "SELECT game_id,character_id,name FROM character_create_requests WHERE account_id=$1 AND request_id=$2", [actor.accountId, id],
    );
    if (receipt.rows[0]) {
      const prior = receipt.rows[0];
      if (prior.game_id !== gameId || prior.name !== sheet.name) throw fail("id_conflict");
      const existing = await client.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2", [gameId, prior.character_id]);
      if (!existing.rows[0]) throw fail("not_found");
      if (!canEditCharacter(access, existing.rows[0].player_id)) throw fail("forbidden");
      const record = { ...present(existing.rows[0], await sheetSequential(client, existing.rows[0])), canEdit: canEditCharacter(access, existing.rows[0].player_id) };
      await client.query("COMMIT");
      return { record, created: false };
    }
    const inserted = await client.query<Row>(
      `INSERT INTO characters(id,game_id,player_id,name,theme,level,dex_die,ins_die,mig_die,wlp_die,current_hp,current_mp,current_ip,fabula_points)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO NOTHING RETURNING *`,
      [id,gameId,access.membershipId,sheet.name,sheet.theme,sheet.level,sheet.baseDice.DEX,sheet.baseDice.INS,sheet.baseDice.MIG,sheet.baseDice.WLP,sheet.resources.hp,sheet.resources.mp,sheet.resources.ip,sheet.resources.fabula],
    );
    if (!inserted.rows[0]) throw fail("id_conflict");
    await client.query("INSERT INTO character_create_requests(account_id,request_id,game_id,character_id,name) VALUES($1,$2,$3,$4,$5)", [actor.accountId,id,gameId,id,sheet.name]);
    if (access.role === "Player") await client.query("UPDATE players SET active_character_id=$2,revision=revision+1 WHERE id=$1 AND active_character_id IS NULL", [access.membershipId,id]);
    await client.query("COMMIT");
    publishGameEvent(gameId, { type: "roster" });
    return { record: { ...present(inserted.rows[0], sheet), canEdit: true }, created: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function setGmCharacterActive(pool: Pool, actor: GameActor, gameId: string, id: string, active: boolean) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await lockGame(client, actor, gameId);
    if (access.role !== "GM") throw fail("forbidden");
    const changed = await client.query("UPDATE characters SET gm_active=$3 WHERE game_id=$1 AND id=$2 AND player_id IS NULL RETURNING id", [gameId,id,active]);
    if (!changed.rowCount) {
      const existing = await client.query("SELECT id FROM characters WHERE game_id=$1 AND id=$2", [gameId,id]);
      throw fail(existing.rowCount ? "forbidden" : "not_found");
    }
    const result = await client.query<SummaryRow>(`${summarySql} WHERE c.game_id=$1 AND c.id=$2`, [gameId,id]);
    await client.query("COMMIT");
    publishGameEvent(gameId, { type: "roster" });
    return summary(result.rows[0]!, access);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function updateWorkspaceCharacter(
  pool: Pool,
  gameId: string,
  actor: GameActor,
  id: string,
  expected: number,
  changes: Partial<FabulaSheet>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const access = await lockGame(c, actor, gameId);
    const found = await c.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2 FOR UPDATE", [gameId, id]);
    const r = found.rows[0];
    if (!r) throw fail("not_found");
    if (!canEditCharacter(access, r.player_id)) throw fail("forbidden");
    if (r.revision !== expected) throw fail("stale_revision");
    const current = await sheetSequential(c, r);
    const s = mergeSheet(current, changes as any);
    if (JSON.stringify(s) === JSON.stringify(current)) {
      await c.query("COMMIT");
      return { ...present(r, current), canEdit: true };
    }
    await c.query(
      "UPDATE characters SET name=$4,theme=$5,level=$6,dex_die=$7,ins_die=$8,mig_die=$9,wlp_die=$10,current_hp=$11,current_mp=$12,current_ip=$13,fabula_points=$14,max_hp_override=$15,max_mp_override=$16,max_ip_override=$17,defense_override=$18,magic_defense_override=$19,initiative_override=$20,revision=revision+1,updated_at=now() WHERE id=$1 AND game_id=$2 AND revision=$3",
      [
        id,
        gameId,
        expected,
        s.name,
        s.theme,
        s.level,
        s.baseDice.DEX,
        s.baseDice.INS,
        s.baseDice.MIG,
        s.baseDice.WLP,
        s.resources.hp,
        s.resources.mp,
        s.resources.ip,
        s.resources.fabula,
        s.overrides.maxHp,
        s.overrides.maxMp,
        s.overrides.maxIp,
        s.overrides.defense,
        s.overrides.magicDefense,
        s.overrides.initiative,
      ],
    );
    const lists: [string, any[]][] = [];
    if ("classes" in changes) lists.push(["character_classes", s.classes]);
    if ("skills" in changes) lists.push(["character_skills", s.skills]);
    if ("equipment" in changes) lists.push(["character_equipment", s.equipment]);
    for (const [table, entries] of lists) {
      await c.query(`DELETE FROM ${table} WHERE character_id=$1`, [id]);
      for (const [i, x] of entries.entries()) {
        if (table === "character_classes")
          await c.query(
            "INSERT INTO character_classes(id,character_id,name,notes,position) VALUES($1,$2,$3,$4,$5)",
            [x.id, id, x.name, x.notes, i + 1],
          );
        else if (table === "character_skills")
          await c.query(
            "INSERT INTO character_skills(id,character_id,name,notes,position) VALUES($1,$2,$3,$4,$5)",
            [x.id, id, x.name, x.notes, i + 1],
          );
        else {
          const z =
            x.kind === "weapon"
              ? [
                  x.equipped,
                  x.accuracyDice[0],
                  x.accuracyDice[1],
                  x.accuracyBonus,
                  null,
                  null,
                  null,
                  null,
                ]
              : x.kind === "armor"
                ? [
                    x.equipped,
                    null,
                    null,
                    null,
                    x.fixedDefense,
                    x.defenseBonus,
                    x.magicDefenseBonus,
                    x.initiativeModifier,
                  ]
                : x.kind === "shield"
                  ? [
                      x.equipped,
                      null,
                      null,
                      null,
                      null,
                      x.defenseBonus,
                      x.magicDefenseBonus,
                      x.initiativeModifier,
                    ]
                  : [null, null, null, null, null, null, null, null];
          await c.query(
            "INSERT INTO character_equipment(id,character_id,name,notes,position,kind,price_zenit,equipped,accuracy_attribute_1,accuracy_attribute_2,accuracy_bonus,fixed_defense,defense_bonus,magic_defense_bonus,initiative_modifier) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
            [x.id, id, x.name, x.notes, i + 1, x.kind, x.priceZenit, ...z],
          );
        }
      }
    }
    const out = present({ ...r, revision: r.revision + 1, updated_at: new Date() }, s);
    await c.query("COMMIT");
    publishGameEvent(gameId, { type: "sheet", characterId: id });
    publishGameEvent(gameId, { type: "roster" });
    return { ...out, canEdit: true };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

async function clearActiveCharacter(client: PoolClient, gameId: string, id: string) {
  await client.query(
    "UPDATE players SET active_character_id=NULL,revision=revision+1 WHERE game_id=$1 AND active_character_id=$2",
    [gameId, id],
  );
}

/** Changes control under the game lock and invalidates all outstanding character links. */
export async function assignCharacter(pool: Pool, actor: GameActor, gameId: string, id: string, membershipId: string | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await lockGame(client, actor, gameId);
    if (access.role !== "GM") throw fail("forbidden");
    const existing = await client.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2 FOR UPDATE", [gameId, id]);
    const character = existing.rows[0];
    if (!character) throw fail("not_found");
    if (membershipId) {
      const target = await client.query("SELECT id FROM players WHERE id=$1 AND game_id=$2 AND NOT removed", [membershipId, gameId]);
      if (!target.rowCount) throw fail("not_found");
    }
    if (character.player_id !== membershipId) {
      await clearActiveCharacter(client, gameId, id);
      await client.query("DELETE FROM invitations WHERE game_id=$1 AND character_id=$2 AND kind='character'", [gameId, id]);
      await client.query("UPDATE characters SET player_id=$3,gm_active=false WHERE game_id=$1 AND id=$2", [gameId, id, membershipId]);
    }
    const result = await client.query<SummaryRow>(`${summarySql} WHERE c.game_id=$1 AND c.id=$2`, [gameId, id]);
    await client.query("COMMIT");
    if (character.player_id !== membershipId) publishGameEvent(gameId, { type: "roster" });
    return summary(result.rows[0]!, access);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

/** Permanently deletes a sheet while preserving its create-request receipt. */
export async function deleteWorkspaceCharacter(pool: Pool, actor: GameActor, gameId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await lockGame(client, actor, gameId);
    const existing = await client.query<Row>("SELECT * FROM characters WHERE game_id=$1 AND id=$2 FOR UPDATE", [gameId, id]);
    const character = existing.rows[0];
    if (!character) throw fail("not_found");
    if (!canEditCharacter(access, character.player_id)) throw fail("forbidden");
    await clearActiveCharacter(client, gameId, id);
    await client.query("DELETE FROM characters WHERE game_id=$1 AND id=$2", [gameId, id]);
    await client.query("COMMIT");
    publishGameEvent(gameId, { type: "roster" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
