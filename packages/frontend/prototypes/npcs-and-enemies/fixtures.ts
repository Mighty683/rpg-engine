import type { Npc } from "./types";

export const goblinSoldier: Npc = {
  id: "goblin-soldier",
  name: "Goblin Sentry",
  level: 5,
  rank: "Soldier",
  // Legal array d8/d8/d8/d8. HP = 2*5 + 5*8 = 50, MP = 5 + 5*8 = 45, crisis = 25,
  // DEF = DEX = 8, MAG DEF = INS = 8, INIT = (8+8)/2 = 8.
  baseDice: { DEX: 8, INS: 8, MIG: 8, WLP: 8 },
  hp: { current: 50, max: 50 },
  mp: { current: 45, max: 45 },
  crisis: 25,
  defense: 8,
  magicDefense: 8,
  initiative: 8,
  attacks: [
    {
      id: "rusty-blade",
      name: "Rusty Blade",
      range: "melee",
      attributes: ["DEX", "MIG"],
      damageBonus: 5,
      damageType: "physical",
    },
    {
      id: "short-bow",
      name: "Short Bow",
      range: "ranged",
      attributes: ["DEX", "INS"],
      damageBonus: 5,
      damageType: "physical",
    },
  ],
  abilities: [
    {
      id: "skirmish",
      name: "Skirmish",
      description: "Can move and make a ranged attack in the same turn.",
    },
  ],
  vulnerabilities: [],
  resistances: [],
  immunities: [],
  statusImmunities: [],
  tags: [
    { name: "Humanoid", color: "primary" },
    { name: "Iron Pass", color: "info" },
  ],
  notes: "Often found in pairs near the old watchtower.",
};

export const darkKnight: Npc = {
  id: "dark-knight",
  name: "Sir Malachar",
  level: 20,
  rank: "Elite",
  // Legal array d10/d10/d6/d6. Soldier HP = 2*20 + 5*6 = 70, elite doubles to 140,
  // crisis = 70. MP = 20 + 5*6 = 50 (elite does not change MP). DEF = 10, MAG DEF = 10,
  // INIT = (10+10)/2 + 2 elite = 12. Level 20 damage bonus = 5 + 5 = 10.
  baseDice: { DEX: 10, INS: 10, MIG: 6, WLP: 6 },
  hp: { current: 140, max: 140 },
  mp: { current: 50, max: 50 },
  crisis: 70,
  defense: 10,
  magicDefense: 10,
  initiative: 12,
  attacks: [
    {
      id: "grave-blade",
      name: "Grave Blade",
      range: "melee",
      attributes: ["MIG", "WLP"],
      damageBonus: 10,
      damageType: "dark",
    },
  ],
  abilities: [
    {
      id: "dread-aura",
      name: "Dread Aura",
      description: "Enemies within close range must check WLP or become shaken.",
    },
    {
      id: "undying",
      name: "Undying",
      description: "Once per scene, when reduced to 0 HP, regain HP equal to half max.",
    },
  ],
  // Undead: immune to dark and poison damage and poisoned; vulnerable to light.
  vulnerabilities: ["light"],
  resistances: [],
  immunities: ["dark", "poison"],
  statusImmunities: ["poisoned"],
  tags: [
    { name: "Undead", color: "error" },
    { name: "Hollow Crown", color: "warning" },
    { name: "Boss", color: "error" },
  ],
  notes: "Commands a squad of skeletal soldiers.",
};

export const forestSpider: Npc = {
  id: "forest-spider",
  name: "Giant Forest Spider",
  level: 10,
  rank: "Soldier",
  // Legal array d10/d8/d8/d6. HP = 2*10 + 5*8 = 60, crisis = 30, MP = 10 + 5*6 = 40,
  // DEF = DEX = 10, MAG DEF = INS = 8, INIT = (10+8)/2 = 9.
  baseDice: { DEX: 10, INS: 8, MIG: 8, WLP: 6 },
  hp: { current: 60, max: 60 },
  mp: { current: 40, max: 40 },
  crisis: 30,
  defense: 10,
  magicDefense: 8,
  initiative: 9,
  attacks: [
    {
      id: "venom-bite",
      name: "Venom Bite",
      range: "melee",
      attributes: ["DEX", "MIG"],
      damageBonus: 5,
      damageType: "poison",
    },
  ],
  abilities: [
    {
      id: "web",
      name: "Web Trap",
      description: "Can ensnare a target, making them dazed.",
    },
  ],
  vulnerabilities: [],
  resistances: [],
  immunities: [],
  statusImmunities: [],
  tags: [
    { name: "Beast", color: "success" },
    { name: "Elder Woods", color: "neutral" },
  ],
  notes: "Cannot use equipment.",
};

export const allNpcs: Npc[] = [goblinSoldier, darkKnight, forestSpider];
