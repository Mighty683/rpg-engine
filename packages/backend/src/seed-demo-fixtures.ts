import { randomUUID } from "node:crypto";
import type { ClassDefinition, ClassModifierStat } from "./modules/class-catalog/types.ts";
export const demoGameId = "bb351a42-48c8-4c7b-a9ec-a136ef8c7461";
const demoGmId = "e160cba7-18c1-456e-8fd4-c346fc41a1a8";
const demoPlayerId = "329e9c0c-e25b-4e84-8f41-dfa339ef7c57";

const scoutId = "9c3f6b68-c935-43e0-8ddd-687b6c107539";
const keeperId = "b7d9a084-e029-4343-a756-e660a343ce59";
export const demoAccounts = [
  { id: demoGmId, username: "demo-gm" },
  { id: demoPlayerId, username: "demo-player" },
  { id: scoutId, username: "demo-scout" },
  { id: keeperId, username: "demo-keeper" },
];

export const campaigns = [
  {
    id: demoGameId,
    name: "The Lantern Road",
    gm: demoGmId,
    gmCharacter: "Rowan Ash",
    members: [
      {
        accountId: demoPlayerId,
        player: "Demo Player",
        character: "Nera Vale",
        weapon: "Roadwarden Rapier",
      },
      { accountId: scoutId, player: "Scout", character: "Finch Reed", weapon: "Thorn Foil" },
    ],
    makeClass: () =>
      makeClass(
        "Lantern Guard",
        "Protects travelers along the Lantern Road.",
        "Watchful",
        "Stay alert while escorting the party.",
        "Keen Senses",
        "dieIns",
        "Signal Fire",
        "Call for aid from the next watchtower.",
      ),
    check: "Read the tracks around the abandoned wagon.",
    notes: [
      [
        "The missing caravan",
        "Mira found a broken axle east of the marsh. Meet her at the third lantern before dusk.",
      ],
      [
        "Vesper’s toll",
        "Captain Vesper lets wagons through if their manifest bears a black wax seal. Who supplies the seals?",
      ],
    ],
  },
  {
    id: "6a693824-95b7-4382-accb-556ff7314a03",
    name: "Glasswater Isles",
    gm: keeperId,
    gmCharacter: "Coral Wren",
    members: [
      {
        accountId: demoPlayerId,
        player: "Demo Player",
        character: "Iona Tide",
        weapon: "Shellguard Rapier",
      },
      {
        accountId: demoGmId,
        player: "Harbor Pilot",
        character: "Tarin Shoal",
        weapon: "Reef Foil",
      },
    ],
    makeClass: () =>
      makeClass(
        "Tide Reader",
        "Guides ships through the shifting reefs.",
        "Soundings",
        "Listen for reefs beneath the hull.",
        "Sea Legs",
        "defense",
        "Star Chart",
        "Plot a course under clear skies.",
      ),
    check: "Find a channel through the submerged ruins.",
    notes: [
      [
        "Low tide charter",
        "The blue bell buoy marks the entrance. The ruins surface for one hour at low tide.",
      ],
      [
        "Pearl divers",
        "Iona promised the divers first choice of salvage in exchange for a chart of the reef.",
      ],
    ],
  },
  {
    id: "ab2e1437-a3b9-432b-93ab-c07bf335647c",
    name: "The Ember Archive",
    gm: demoGmId,
    gmCharacter: "Vela Cinder",
    members: [
      {
        accountId: demoPlayerId,
        player: "Demo Player",
        character: "Sol Quill",
        weapon: "Brass Rapier",
      },
      { accountId: scoutId, player: "Scout", character: "Eris Flint", weapon: "Cinder Foil" },
    ],
    makeClass: () =>
      makeClass(
        "Ash Archivist",
        "Recovers records from the buried library.",
        "Decipher",
        "Read heat-scarred inscriptions.",
        "Quiet Focus",
        "magicDefense",
        "Fire Script",
        "Leave a message in the soot.",
      ),
    check: "Translate the inscription on the furnace door.",
    notes: [
      [
        "The sealed stacks",
        "Three brass keys open the lower stacks. Sol recovered the first in a cold furnace.",
      ],
      [
        "Last shift",
        "The night ledger names Eris as the last visitor before the archive went dark.",
      ],
    ],
  },
] satisfies Campaign[];

export type Campaign = {
  id: string;
  name: string;
  gm: string;
  gmCharacter: string;
  check: string;
  notes: [string, string][];
  makeClass: () => ClassDefinition;
  members: { accountId: string; player: string; character: string; weapon: string }[];
};

function makeClass(
  name: string,
  description: string,
  skill: string,
  skillDescription: string,
  benefit: string,
  stat: ClassModifierStat,
  secondSkill: string,
  secondDescription: string,
): ClassDefinition {
  return {
    name,
    description,
    freeBenefits: [
      { id: randomUUID(), kind: "modifier", name: "Stalwart", stat: "maxHp", amount: 5 },
    ],
    skills: [
      {
        id: randomUUID(),
        name: skill,
        description: skillDescription,
        maxRank: 2,
        benefits: [{ id: randomUUID(), kind: "modifier", name: benefit, stat, amount: 1 }],
      },
      {
        id: randomUUID(),
        name: secondSkill,
        description: secondDescription,
        maxRank: 1,
        benefits: [],
      },
    ],
  };
}

export const npcFixtures = [
  {
    id: randomUUID(),
    name: "Captain Vesper",
    relationship: "enemy" as const,
    visibility: "known" as const,
    level: 20,
    dexDie: 10,
    insDie: 8,
    migDie: 10,
    wlpDie: 8,
    currentHp: 90,
    maxHp: 90,
    currentMp: 40,
    maxMp: 40,
    defense: 10,
    magicDefense: 8,
    notes: "Commands the raiders on the Lantern Road.",
    attack: {
      name: "Saber",
      reach: "melee" as const,
      attribute1: "DEX",
      attribute2: "MIG",
      damageBonus: 10,
      damageType: "physical",
    },
  },
  {
    id: randomUUID(),
    name: "Mira the Guide",
    relationship: "friend" as const,
    visibility: "visible" as const,
    level: 10,
    dexDie: 8,
    insDie: 10,
    migDie: 6,
    wlpDie: 8,
    currentHp: 50,
    maxHp: 50,
    currentMp: 30,
    maxMp: 30,
    defense: 8,
    magicDefense: 9,
    notes: "Knows a safe route through the marsh.",
    attack: {
      name: "Shortbow",
      reach: "ranged" as const,
      attribute1: "DEX",
      attribute2: "INS",
      damageBonus: 6,
      damageType: "physical",
    },
  },
  {
    id: randomUUID(),
    name: "The Masked Patron",
    relationship: "neutral" as const,
    visibility: "hidden" as const,
    level: 15,
    dexDie: 8,
    insDie: 10,
    migDie: 6,
    wlpDie: 10,
    currentHp: 60,
    maxHp: 60,
    currentMp: 50,
    maxMp: 50,
    defense: 8,
    magicDefense: 10,
    notes: "Secretly funds both sides of the conflict.",
    attack: {
      name: "Arcane Bolt",
      reach: "ranged" as const,
      attribute1: "INS",
      attribute2: "WLP",
      damageBonus: 8,
      damageType: "arcane",
    },
  },
];
