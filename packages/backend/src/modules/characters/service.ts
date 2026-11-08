import { eq } from "drizzle-orm";
import {
  characterClasses,
  characterSkills,
  characterEquipment,
  equipmentFields,
} from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/client.ts";
import { preview, validateSheet, type FabulaSheet } from "../fabula/rules.ts";
export type Sheet = FabulaSheet;
export type Row = {
  id: string;
  player_id: string | null;
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
export async function sheetSequential(tx: DatabaseTransaction, r: Row): Promise<FabulaSheet> {
  const db = tx;
  const a = await db
    .select({
      id: characterClasses.id,
      name: characterClasses.name,
      notes: characterClasses.notes,
      position: characterClasses.position,
    })
    .from(characterClasses)
    .where(eq(characterClasses.characterId, r.id))
    .orderBy(characterClasses.position);
  const b = await db
    .select({
      id: characterSkills.id,
      name: characterSkills.name,
      notes: characterSkills.notes,
      position: characterSkills.position,
    })
    .from(characterSkills)
    .where(eq(characterSkills.characterId, r.id))
    .orderBy(characterSkills.position);
  const e = await db
    .select(equipmentFields)
    .from(characterEquipment)
    .where(eq(characterEquipment.characterId, r.id))
    .orderBy(characterEquipment.position);
  const equipment = e.map((x): any => {
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
    classes: a.map(({ id, name, notes }) => ({ id, name, notes })),
    skills: b.map(({ id, name, notes }) => ({ id, name, notes })),
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

export const present = (r: Row, s: FabulaSheet) => ({
  id: r.id,
  playerId: r.player_id,
  name: s.name,
  level: s.level,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
  revision: r.revision,
  systemId: "fabula-ultima" as const,
  sheet: s,
  derived: preview(s),
});
