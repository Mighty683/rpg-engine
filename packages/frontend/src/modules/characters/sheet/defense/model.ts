/** Calculates ordinary equipment contributions from the supplied effective dice. */
import type { Sheet } from "../types";

export function projectDefenses(sheet: Sheet, currentDice = sheet.baseDice) {
  const armor = sheet.equipment.filter((item) => item.kind === "armor" && item.equipped);
  const shields = sheet.equipment.filter((item) => item.kind === "shield" && item.equipped);
  const equipment = [...armor, ...shields];
  const ambiguous = armor.length > 1 || shields.length > 1;
  const contributions = (key: "defenseBonus" | "magicDefenseBonus" | "initiativeModifier") =>
    equipment.map((item) => ({ source: item.kind, entryId: item.id, value: item[key] ?? 0 }));
  const physical = [
    ...(armor[0]?.fixedDefense != null
      ? [{ source: "armor", entryId: armor[0].id, value: armor[0].fixedDefense }]
      : [
          { source: "DEX", value: currentDice.DEX },
          ...contributions("defenseBonus").filter((part) => part.source === "armor"),
        ]),
    ...contributions("defenseBonus").filter((part) => part.source === "shield"),
  ];
  const magic = [{ source: "INS", value: currentDice.INS }, ...contributions("magicDefenseBonus")];
  const initiative = contributions("initiativeModifier");
  const calculated = (parts: { source: string; entryId?: string; value: number }[]) =>
    ambiguous
      ? { calculated: null, reason: "ambiguous_equipment", contributions: [] }
      : { calculated: parts.reduce((sum, part) => sum + part.value, 0), contributions: parts };
  return {
    defense: calculated(physical),
    magicDefense: calculated(magic),
    initiative: calculated(initiative),
  };
}
