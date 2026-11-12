import type { Npc } from "../../../src/modules/npcs/types";

export const npc: Npc = {
  id: "ash-wolf",
  name: "Ash Wolf",
  relationship: "enemy",
  level: 10,
  visibility: "known",
  baseDice: { DEX: 10, INS: 8, MIG: 10, WLP: 6 },
  hp: { current: 35, max: 50 },
  mp: { current: 15, max: 30 },
  crisis: 25,
  defense: 10,
  magicDefense: 8,
  initiative: 10,
  attacks: [
    {
      id: "bite",
      name: "Bite",
      range: "melee",
      attributes: ["DEX", "MIG"],
      damageBonus: 5,
      damageType: "physical",
    },
  ],
  abilities: [],
  vulnerabilities: [],
  resistances: [],
  immunities: [],
  statusImmunities: [],
  tags: [],
  notes: "A territorial hunter.",
};
