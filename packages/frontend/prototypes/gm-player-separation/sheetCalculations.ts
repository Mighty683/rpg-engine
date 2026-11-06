import type { Character, NamedEntry } from "../../src/modules/characters/sheet/types";

/** Partial prototype calculations; these do not implement the complete rules. */
export function calculateResourceMaximum(character: Character) {
  const classes = new Set(character.classes.map((entry) => entry.name.trim().toLowerCase()));
  return {
    HP: character.level + 5 * Number(character.attributes.MIG) + ["weaponmaster", "guardian"].filter((name) => classes.has(name)).length * 5,
    MP: character.level + 5 * Number(character.attributes.WLP) + (classes.has("orator") ? 5 : 0),
    IP: 6 + (classes.has("rogue") ? 2 : 0),
  };
}

type Contribution = { name: string; value: number; modifier?: boolean };
function contributions(base: Contribution, extras: Array<[string, number]>): Contribution[] {
  return [base, ...extras.filter(([, value]) => value !== 0).map(([name, value]) => ({ name, value, modifier: true }))];
}
function equipped(items: NamedEntry[], kind: "armor" | "shield") {
  return items.find((item) => item.itemType === "armor" && item.defenseKind === kind && item.equipped);
}

export function calculateDefense(character: Character) {
  const armorItem = equipped(character.equipment, "armor");
  const shieldItem = equipped(character.equipment, "shield");
  const armor = armorItem?.armor;
  const shield = shieldItem?.shield;
  const physicalBase = armor?.fixedDefense == null
    ? { name: "DEX", value: Number(character.attributes.DEX) }
    : { name: `${armorItem?.name} (fixed)`, value: armor.fixedDefense };
  const details = {
    DEF: contributions(physicalBase, [[armorItem?.name || "Armor", armor?.fixedDefense == null ? armor?.physicalBonus ?? 0 : 0], [shieldItem?.name || "Shield", shield?.physicalBonus ?? 0]]),
    "MAG DEF": contributions({ name: "INS", value: Number(character.attributes.INS) }, [[armorItem?.name || "Armor", armor?.magicBonus ?? 0], [shieldItem?.name || "Shield", shield?.magicBonus ?? 0]]),
    INIT: contributions({ name: "Base", value: 0 }, [[armorItem?.name || "Armor", armor?.initiative ?? 0], [shieldItem?.name || "Shield", shield?.initiative ?? 0]]),
  };
  const sum = (entries: Contribution[]) => entries.reduce((total, entry) => total + entry.value, 0);
  return { details, values: { DEF: sum(details.DEF), "MAG DEF": sum(details["MAG DEF"]), INIT: sum(details.INIT) } };
}
