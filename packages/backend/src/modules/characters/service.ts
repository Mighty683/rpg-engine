import type { PoolClient } from "pg";
import {
  preview,
  validateSheet,
  type FabulaSheet,
} from "../fabula/rules.ts";
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
export async function sheetSequential(client: PoolClient, r: Row): Promise<FabulaSheet> {
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

export const present = (r: Row, s: FabulaSheet) => ({
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
