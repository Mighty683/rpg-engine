import type { PartyMember } from "./model";
import type { Sheet } from "../../src/modules/characters/sheet/model";

export const sheetFixtures: Record<string, Pick<Sheet, "classes" | "equipment" | "overrides">> = {
  rowan: {
    classes: [{ id: "rowan-guardian", name: "Guardian", notes: "" }],
    equipment: [
      { id: "rowan-sword", name: "Longsword", notes: "", kind: "weapon", priceZenit: null, equipped: true, accuracyDice: ["DEX", "MIG"], accuracyBonus: 1 },
      { id: "rowan-bow", name: "Bow", notes: "", kind: "weapon", priceZenit: null, equipped: false, accuracyDice: ["DEX", "INS"], accuracyBonus: 0 },
      { id: "rowan-armor", name: "Chain armor", notes: "", kind: "armor", priceZenit: null, equipped: true, fixedDefense: 10, defenseBonus: 0, magicDefenseBonus: 0, initiativeModifier: -1 },
      { id: "rowan-shield", name: "Shield", notes: "", kind: "shield", priceZenit: null, equipped: true, defenseBonus: 2, magicDefenseBonus: 0, initiativeModifier: 0 },
    ],
    overrides: { maxHp: null, maxMp: null, maxIp: null, defense: 12, magicDefense: 8, initiative: -1 },
  },
  nera: {
    classes: [{ id: "nera-elementalist", name: "Elementalist", notes: "" }, { id: "nera-orator", name: "Orator", notes: "" }],
    equipment: [
      { id: "nera-dagger", name: "Dagger", notes: "", kind: "weapon", priceZenit: null, equipped: true, accuracyDice: ["DEX", "INS"], accuracyBonus: 1 },
      { id: "nera-garb", name: "Travel garb", notes: "", kind: "armor", priceZenit: null, equipped: true, fixedDefense: null, defenseBonus: 1, magicDefenseBonus: 1, initiativeModifier: -1 },
    ],
    overrides: { maxHp: null, maxMp: null, maxIp: null, defense: 9, magicDefense: 11, initiative: -1 },
  },
};

export const party: PartyMember[] = [
  {
    id: "rowan",
    name: "Rowan Ash",
    controller: "GM",
    hp: { current: 28, max: 35 },
    mp: { current: 24, max: 35 },
    ip: { current: 5, max: 6 },
    fabula: 3,
    baseDice: { DEX: 8, INS: 8, MIG: 10, WLP: 6 },
  },
  {
    id: "nera",
    name: "Nera Vale",
    controller: "demo-player",
    hp: { current: 16, max: 35 },
    mp: { current: 32, max: 45 },
    ip: { current: 3, max: 6 },
    fabula: 2,
    baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
  },
];
