import type { Sheet } from "./types";
import { expect, test } from "vite-plus/test";
import { toCharacter, toSheet } from "./model";

test("maps existing character data and every equipment type without losing API fields", () => {
  const sheet: Sheet = {
    name: "Knight",
    theme: "Hope",
    level: 12,
    baseDice: { DEX: 12, INS: 10, MIG: 8, WLP: 6 },
    classes: [{ id: "c", name: "Guardian", notes: "Class notes" }],
    skills: [{ id: "s", name: "Guard", notes: "Skill notes" }],
    equipment: [
      { id: "i", name: "Rope", notes: "", priceZenit: 4, kind: "other" },
      {
        id: "w",
        name: "Sword",
        notes: "",
        priceZenit: null,
        kind: "weapon",
        equipped: true,
        accuracyDice: ["DEX", null],
        accuracyBonus: 2,
      },
      {
        id: "a",
        name: "Armor",
        notes: "",
        priceZenit: 9,
        kind: "armor",
        equipped: true,
        fixedDefense: 11,
        defenseBonus: 1,
        magicDefenseBonus: -1,
        initiativeModifier: -2,
      },
      {
        id: "h",
        name: "Shield",
        notes: "",
        priceZenit: 5,
        kind: "shield",
        equipped: false,
        defenseBonus: 2,
        magicDefenseBonus: 1,
        initiativeModifier: 0,
      },
    ],
    resources: { hp: 20, mp: 10, ip: 3, fabula: 2 },
    overrides: { maxHp: 55, maxMp: 60, maxIp: 8, defense: 13, magicDefense: null, initiative: -1 },
  };
  const character = toCharacter(sheet, "character", false);
  expect(toSheet(character, sheet)).toEqual(sheet);
  character.identity.theme = "Justice";
  character.equipment[1]!.weapon!.attributes[1] = "MIG";
  const updated = toSheet(character, sheet);
  expect(updated.theme).toBe("Justice");
  expect(updated.equipment[1]?.accuracyDice).toEqual(["DEX", "MIG"]);
  expect(updated.overrides).toEqual(sheet.overrides);
});
