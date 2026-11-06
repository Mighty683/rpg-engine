// Game Table active-party projection: a consistent batched read of each active
// character's sheet fields and derived values for the compact party cards. Active
// criteria match the roster: GM-controlled characters need gm_active, player-
// controlled characters must be the member's current active choice.
import type { Pool, PoolClient } from "pg";
import { preview, validateSheet, type Attribute, type FabulaSheet } from "../fabula/rules.ts";
import { gameAccess, type GameActor, type GameAccess } from "../games/service.ts";
import type { Row } from "./service.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });

type NamedRow = { id: string; character_id: string; name: string; notes: string; position: number };
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

export type PartyWeapon = {
  id: string;
  name: string;
  equipped: boolean;
  accuracyDice: [Attribute | null, Attribute | null];
  accuracyBonus: number | null;
  ready: boolean;
};

export type PartyCharacter = {
  id: string;
  revision: number;
  name: string;
  classes: string[];
  baseDice: Record<Attribute, number>;
  resources: { hp: number; mp: number; ip: number; fabula: number };
  maxima: { hp: number; mp: number; ip: number };
  defense: number | null;
  magicDefense: number | null;
  weapons: PartyWeapon[];
  canRoll: boolean;
};

function equipmentEntry(row: EquipmentRow) {
  const base = { id: row.id, name: row.name, notes: row.notes, priceZenit: row.price_zenit };
  if (row.kind === "weapon")
    return { ...base, kind: "weapon" as const, equipped: Boolean(row.equipped), accuracyDice: [row.accuracy_attribute_1, row.accuracy_attribute_2] as [Attribute | null, Attribute | null], accuracyBonus: row.accuracy_bonus };
  if (row.kind === "armor")
    return { ...base, kind: "armor" as const, equipped: Boolean(row.equipped), fixedDefense: row.fixed_defense, defenseBonus: row.defense_bonus ?? 0, magicDefenseBonus: row.magic_defense_bonus ?? 0, initiativeModifier: row.initiative_modifier ?? 0 };
  if (row.kind === "shield")
    return { ...base, kind: "shield" as const, equipped: Boolean(row.equipped), defenseBonus: row.defense_bonus ?? 0, magicDefenseBonus: row.magic_defense_bonus ?? 0, initiativeModifier: row.initiative_modifier ?? 0 };
  return { ...base, kind: "other" as const };
}

async function batchedSheets(client: PoolClient, rows: Row[]): Promise<Map<string, FabulaSheet>> {
  const ids = rows.map((row) => row.id);
  const classes = await client.query<NamedRow>("SELECT id,character_id,name,notes,position FROM character_classes WHERE character_id=ANY($1::uuid[]) ORDER BY character_id,position", [ids]);
  const equipment = await client.query<EquipmentRow>("SELECT * FROM character_equipment WHERE character_id=ANY($1::uuid[]) ORDER BY character_id,position", [ids]);
  const byCharacter = <T extends { character_id: string }>(list: T[]) => {
    const map = new Map<string, T[]>();
    for (const entry of list) {
      const group = map.get(entry.character_id) ?? [];
      group.push(entry);
      map.set(entry.character_id, group);
    }
    return map;
  };
  const classMap = byCharacter(classes.rows);
  const equipmentMap = byCharacter(equipment.rows);
  return new Map(
    rows.map((row) => {
      const sheet = validateSheet({
        name: row.name,
        theme: row.theme,
        level: row.level,
        baseDice: { DEX: row.dex_die, INS: row.ins_die, MIG: row.mig_die, WLP: row.wlp_die },
        classes: (classMap.get(row.id) ?? []).map(({ id, name, notes }) => ({ id, name, notes })),
        skills: [],
        equipment: (equipmentMap.get(row.id) ?? []).map(equipmentEntry),
        resources: { hp: row.current_hp, mp: row.current_mp, ip: row.current_ip, fabula: row.fabula_points },
        overrides: {
          maxHp: row.max_hp_override,
          maxMp: row.max_mp_override,
          maxIp: row.max_ip_override,
          defense: row.defense_override,
          magicDefense: row.magic_defense_override,
          initiative: row.initiative_override,
        },
      });
      return [row.id, sheet] as const;
    }),
  );
}

const activeRowsSql = `SELECT c.* FROM characters c LEFT JOIN players p ON p.id=c.player_id AND p.game_id=c.game_id
  WHERE c.game_id=$1 AND (CASE WHEN c.player_id IS NULL THEN c.gm_active ELSE COALESCE(p.active_character_id=c.id, false) END)
  ORDER BY c.created_at,c.id`;

/** Derives the viewer's roll capability from current access, independently of sheet edit rights. */
function canRoll(access: GameAccess, playerId: string | null) {
  return access.role === "GM" || access.membershipId === playerId;
}

export async function listActiveParty(pool: Pool, actor: GameActor, gameId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const access = await gameAccess(client, actor, gameId);
    if (!access) throw fail("not_found");
    const characters = await client.query<Row>(activeRowsSql, [gameId]);
    const sheets = await batchedSheets(client, characters.rows);
    await client.query("COMMIT");
    const party: PartyCharacter[] = characters.rows.map((row) => {
      const sheet = sheets.get(row.id)!;
      const derived = preview(sheet);
      const weapons: PartyWeapon[] = sheet.equipment
        .filter((entry): entry is Extract<typeof entry, { kind: "weapon" }> => entry.kind === "weapon")
        .map((weapon) => ({
          id: weapon.id,
          name: weapon.name,
          equipped: weapon.equipped,
          accuracyDice: weapon.accuracyDice,
          accuracyBonus: weapon.accuracyBonus,
          ready: Boolean(weapon.accuracyDice[0] && weapon.accuracyDice[1] && weapon.accuracyBonus !== null),
        }));
      return {
        id: row.id,
        revision: row.revision,
        name: sheet.name,
        classes: sheet.classes.map((entry) => entry.name),
        baseDice: { ...sheet.baseDice },
        resources: { ...sheet.resources },
        maxima: { ...derived.maxima },
        defense: sheet.overrides.defense ?? derived.defenses.defense.calculated,
        magicDefense: sheet.overrides.magicDefense ?? derived.defenses.magicDefense.calculated,
        weapons,
        canRoll: canRoll(access, row.player_id),
      };
    });
    return { characters: party };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
