/** Character persistence conversion shared by full sheets and batched party projections. */
import type { Attribute, EquipmentEntry, FabulaSheet } from "../fabula/types.ts";
import { validateSheet } from "../fabula/rules.ts";
import type { EquipmentInsert, EquipmentRow, Row, SheetCollections } from "./types.ts";

function equipmentAttribute(value: string | null): Attribute | null {
  if (value === null || value === "DEX" || value === "INS" || value === "MIG" || value === "WLP")
    return value;
  throw new Error("Saved equipment references an unknown attribute");
}

export function equipmentFromRow(row: EquipmentRow): EquipmentEntry {
  const base = { id: row.id, name: row.name, notes: row.notes, priceZenit: row.price_zenit };
  if (row.kind === "other") return { ...base, kind: "other" };
  if (row.kind === "weapon")
    return {
      ...base,
      kind: "weapon",
      equipped: Boolean(row.equipped),
      accuracyDice: [
        equipmentAttribute(row.accuracy_attribute_1),
        equipmentAttribute(row.accuracy_attribute_2),
      ],
      accuracyBonus: row.accuracy_bonus,
    };
  const modifiers = {
    equipped: Boolean(row.equipped),
    defenseBonus: row.defense_bonus ?? 0,
    magicDefenseBonus: row.magic_defense_bonus ?? 0,
    initiativeModifier: row.initiative_modifier ?? 0,
  };
  if (row.kind === "armor")
    return { ...base, ...modifiers, kind: "armor", fixedDefense: row.fixed_defense };
  if (row.kind === "shield") return { ...base, ...modifiers, kind: "shield" };
  throw new Error("Saved equipment references an unknown kind");
}

/** Explicit nulls clear fields belonging to a previous equipment kind. */
export function equipmentToRow(
  characterId: string,
  position: number,
  entry: EquipmentEntry,
): EquipmentInsert {
  const base = {
    id: entry.id,
    characterId,
    position,
    name: entry.name,
    notes: entry.notes,
    kind: entry.kind,
    priceZenit: entry.priceZenit,
    equipped: null,
    accuracyAttribute1: null,
    accuracyAttribute2: null,
    accuracyBonus: null,
    fixedDefense: null,
    defenseBonus: null,
    magicDefenseBonus: null,
    initiativeModifier: null,
  };
  if (entry.kind === "other") return base;
  if (entry.kind === "weapon")
    return {
      ...base,
      equipped: entry.equipped,
      accuracyAttribute1: entry.accuracyDice[0],
      accuracyAttribute2: entry.accuracyDice[1],
      accuracyBonus: entry.accuracyBonus,
    };
  return {
    ...base,
    equipped: entry.equipped,
    fixedDefense: entry.kind === "armor" ? entry.fixedDefense : null,
    defenseBonus: entry.defenseBonus,
    magicDefenseBonus: entry.magicDefenseBonus,
    initiativeModifier: entry.initiativeModifier,
  };
}

/** Fetch strategy stays with callers; both projections use the same field conversion and rules. */
export function assembleSheet(row: Row, collections: SheetCollections): FabulaSheet {
  return validateSheet({
    name: row.name,
    theme: row.theme,
    level: row.level,
    baseDice: { DEX: row.dex_die, INS: row.ins_die, MIG: row.mig_die, WLP: row.wlp_die },
    classes: collections.classes.map(({ id, name, notes }) => ({ id, name, notes })),
    skills: collections.skills.map(({ id, name, notes }) => ({ id, name, notes })),
    equipment: collections.equipment.map(equipmentFromRow),
    resources: {
      hp: row.current_hp,
      mp: row.current_mp,
      ip: row.current_ip,
      fabula: row.fabula_points,
    },
    overrides: {
      maxHp: row.max_hp_override,
      maxMp: row.max_mp_override,
      maxIp: row.max_ip_override,
      defense: row.defense_override,
      magicDefense: row.magic_defense_override,
      initiative: row.initiative_override,
    },
  });
}
