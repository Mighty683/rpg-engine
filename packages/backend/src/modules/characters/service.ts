import type { Pool, PoolClient } from "pg";
import {
  defaultSheet,
  mergeSheet,
  preview,
  validateSheet,
  type FabulaSheet,
} from "../fabula/rules.ts";
export type Sheet = FabulaSheet;
type Row = {
  id: string;
  player_id: string;
  name: string;
  theme: string | null;
  level: number;
  dex_die: number;
  ins_die: number;
  mig_die: number;
  wlp_die: number;
  current_hp: number;
  current_mp: number;
  current_ip: number;
  fabula_points: number;
  max_hp_override: number | null;
  max_mp_override: number | null;
  max_ip_override: number | null;
  defense_override: number | null;
  magic_defense_override: number | null;
  initiative_override: number | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
};
type NamedRow = { id: string; name: string; notes: string; position: number };
type EquipmentRow = NamedRow & {
  kind: string;
  price_zenit: number | null;
  equipped: boolean | null;
  accuracy_attribute_1: string | null;
  accuracy_attribute_2: string | null;
  accuracy_bonus: number | null;
  fixed_defense: number | null;
  defense_bonus: number | null;
  magic_defense_bonus: number | null;
  initiative_modifier: number | null;
};
const fail = (code: string) => Object.assign(new Error(code), { code });
async function sheetSequential(client: PoolClient, r: Row): Promise<FabulaSheet> {
  const a = await client.query<NamedRow>(
    "SELECT id,name,notes,position FROM character_classes WHERE character_id=$1 ORDER BY position",
    [r.id],
  );
  const b = await client.query<NamedRow>(
    "SELECT id,name,notes,position FROM character_skills WHERE character_id=$1 ORDER BY position",
    [r.id],
  );
  const e = await client.query<EquipmentRow>(
    "SELECT * FROM character_equipment WHERE character_id=$1 ORDER BY position",
    [r.id],
  );
  const equipment = e.rows.map((x): any => {
    const base = { id: x.id, name: x.name, notes: x.notes, priceZenit: x.price_zenit };
    if (x.kind === "other") return { ...base, kind: "other" };
    if (x.kind === "weapon")
      return {
        ...base,
        kind: "weapon",
        equipped: Boolean(x.equipped),
        accuracyDice: [x.accuracy_attribute_1, x.accuracy_attribute_2],
        accuracyBonus: x.accuracy_bonus,
      };
    if (x.kind === "armor")
      return {
        ...base,
        kind: "armor",
        equipped: Boolean(x.equipped),
        fixedDefense: x.fixed_defense,
        defenseBonus: x.defense_bonus ?? 0,
        magicDefenseBonus: x.magic_defense_bonus ?? 0,
        initiativeModifier: x.initiative_modifier ?? 0,
      };
    return {
      ...base,
      kind: "shield",
      equipped: Boolean(x.equipped),
      defenseBonus: x.defense_bonus ?? 0,
      magicDefenseBonus: x.magic_defense_bonus ?? 0,
      initiativeModifier: x.initiative_modifier ?? 0,
    };
  });
  return validateSheet({
    name: r.name,
    theme: r.theme,
    level: r.level,
    baseDice: { DEX: r.dex_die, INS: r.ins_die, MIG: r.mig_die, WLP: r.wlp_die },
    classes: a.rows.map(({ id, name, notes }) => ({ id, name, notes })),
    skills: b.rows.map(({ id, name, notes }) => ({ id, name, notes })),
    equipment,
    resources: { hp: r.current_hp, mp: r.current_mp, ip: r.current_ip, fabula: r.fabula_points },
    overrides: {
      maxHp: r.max_hp_override,
      maxMp: r.max_mp_override,
      maxIp: r.max_ip_override,
      defense: r.defense_override,
      magicDefense: r.magic_defense_override,
      initiative: r.initiative_override,
    },
  });
}

const present = (r: Row, s: FabulaSheet) => ({
  id: r.id,
  playerId: r.player_id,
  name: s.name,
  level: s.level,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  revision: r.revision,
  systemId: "fabula-ultima" as const,
  sheet: s,
  derived: preview(s),
});
async function row(client: PoolClient, gameId: string, playerId: string, id: string, lock = false) {
  const q = await client.query<Row>(
    `SELECT c.* FROM characters c JOIN players p ON p.id=c.player_id WHERE p.game_id=$1 AND c.player_id=$2 AND c.id=$3${lock ? " FOR UPDATE" : ""}`,
    [gameId, playerId, id],
  );
  return q.rows[0];
}
export async function listCharacters(pool: Pool, gameId: string, playerId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const q = await c.query<Row>(
      "SELECT c.* FROM characters c JOIN players p ON p.id=c.player_id WHERE p.game_id=$1 AND c.player_id=$2 ORDER BY c.created_at,c.id",
      [gameId, playerId],
    );
    const out = [];
    for (const r of q.rows) {
      const s = await sheetSequential(c, r);
      out.push({
        id: r.id,
        playerId: r.player_id,
        name: s.name,
        level: s.level,
        createdAt: r.created_at.toISOString(),
      });
    }
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function getCharacter(pool: Pool, gameId: string, playerId: string, id: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const r = await row(c, gameId, playerId, id);
    if (!r) {
      await c.query("COMMIT");
      return null;
    }
    const out = present(r, await sheetSequential(c, r));
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function createCharacter(
  pool: Pool,
  gameId: string,
  playerId: string,
  id: string,
  name: string,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const s = defaultSheet(name);
    const q = await c.query<Row>(
      "INSERT INTO characters(id,player_id,name,theme,level,dex_die,ins_die,mig_die,wlp_die,current_hp,current_mp,current_ip,fabula_points) SELECT $1,p.id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13 FROM players p WHERE p.id=$2 AND p.game_id=$14 ON CONFLICT(id) DO NOTHING RETURNING *",
      [
        id,
        playerId,
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
        gameId,
      ],
    );
    if (q.rows[0]) {
      await c.query("COMMIT");
      return { record: present(q.rows[0], s), created: true };
    }
    const old = await c.query<Row>(
      "SELECT c.* FROM characters c JOIN players p ON p.id=c.player_id WHERE c.id=$1 AND p.game_id=$2",
      [id, gameId],
    );
    if (!old.rows[0]) throw fail("not_found");
    if (old.rows[0].player_id !== playerId) throw fail("id_conflict");
    const out = present(old.rows[0], await sheetSequential(c, old.rows[0]));
    await c.query("COMMIT");
    return { record: out, created: false };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function updateCharacter(
  pool: Pool,
  gameId: string,
  playerId: string,
  id: string,
  expected: number,
  changes: Partial<Sheet>,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await row(c, gameId, playerId, id, true);
    if (!r) throw fail("not_found");
    if (r.revision !== expected) throw fail("stale_revision");
    const current = await sheetSequential(c, r);
    const s = mergeSheet(current, changes as any);
    if (JSON.stringify(s) === JSON.stringify(current)) {
      await c.query("COMMIT");
      return present(r, current);
    }
    await c.query(
      "UPDATE characters SET name=$4,theme=$5,level=$6,dex_die=$7,ins_die=$8,mig_die=$9,wlp_die=$10,current_hp=$11,current_mp=$12,current_ip=$13,fabula_points=$14,max_hp_override=$15,max_mp_override=$16,max_ip_override=$17,defense_override=$18,magic_defense_override=$19,initiative_override=$20,revision=revision+1,updated_at=now() WHERE id=$1 AND player_id=$2 AND revision=$3",
      [
        id,
        playerId,
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
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
