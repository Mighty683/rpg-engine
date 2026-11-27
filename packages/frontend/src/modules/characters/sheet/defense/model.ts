import type { ApiSchema } from "@rpg-engine/api-schema";
/** Calculates ordinary equipment contributions from the supplied effective dice. */
import type { Equipment, Sheet } from "../types";

type DefenseSheet = Pick<Sheet, "baseDice"> & { equipment: Omit<Equipment, "accuracyDice">[] };

export function projectDefenses(sheet: DefenseSheet, currentDice = sheet.baseDice) {
  const armor = sheet.equipment.filter((item) => item.kind === "armor" && item.equipped);
  const shields = sheet.equipment.filter((item) => item.kind === "shield" && item.equipped);
  const equipment = [...armor, ...shields];
  const ambiguous = armor.length > 1 || shields.length > 1;
  type Part = Extract<
    ApiSchema["CalculatedDefense"],
    { calculated: number }
  >["contributions"][number];
  const contributions = (
    key: "defenseBonus" | "magicDefenseBonus" | "initiativeModifier",
  ): Part[] =>
    equipment.map((item) => ({
      source: item.kind === "armor" ? "armor" : "shield",
      entryId: item.id,
      value: item[key] ?? 0,
    }));
  const physical = [
    ...(armor[0]?.fixedDefense != null
      ? [{ source: "armor" as const, entryId: armor[0].id, value: armor[0].fixedDefense }]
      : [
          { source: "DEX" as const, value: currentDice.DEX },
          ...contributions("defenseBonus").filter((part) => part.source === "armor"),
        ]),
    ...contributions("defenseBonus").filter((part) => part.source === "shield"),
  ];
  const magic = [
    { source: "INS" as const, value: currentDice.INS },
    ...contributions("magicDefenseBonus"),
  ];
  const initiative = contributions("initiativeModifier");
  const calculated = (parts: Part[]) =>
    ambiguous
      ? { calculated: null, reason: "ambiguous_equipment" as const, contributions: [] }
      : { calculated: parts.reduce((sum, part) => sum + part.value, 0), contributions: parts };
  return {
    defense: calculated(physical),
    magicDefense: calculated(magic),
    initiative: calculated(initiative),
  };
}
