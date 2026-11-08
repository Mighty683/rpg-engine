import type { Character, NamedEntry } from "../../src/modules/characters/sheet/types";
import type {
  PartyCharacter,
  PartyWeapon,
  ThrowRecord,
} from "../../src/modules/game-table/types";
import type { GameCharacterSummary } from "../../src/modules/characters/types";
import type { GameMember } from "../../src/modules/games/types";

export const sword: PartyWeapon = {
  id: "longsword",
  name: "Longsword",
  equipped: true,
  accuracyDice: ["DEX", "MIG"],
  accuracyBonus: 1,
  ready: true,
};

export const partyMember: PartyCharacter = {
  id: "rowan",
  revision: 1,
  name: "Rowan Ash",
  classes: ["Guardian"],
  baseDice: { DEX: 8, INS: 8, MIG: 10, WLP: 6 },
  resources: { hp: 28, mp: 24, ip: 5, fabula: 3 },
  maxima: { hp: 35, mp: 35, ip: 6 },
  defense: 12,
  magicDefense: 8,
  weapons: [sword],
  canRoll: true,
};

export const characterSummary: GameCharacterSummary = {
  id: partyMember.id,
  name: partyMember.name,
  level: 5,
  controllerMembershipId: "member-nera",
  controllerName: "Nera",
  canEdit: true,
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
};

export const members: GameMember[] = [
  {
    id: "member-nera",
    accountId: "account-nera",
    name: "Nera",
    removed: false,
    activeCharacterId: partyMember.id,
    revision: 1,
  },
];

export const guardian: NamedEntry = {
  id: "guardian",
  name: "Guardian",
  notes: "Protects the party.",
  price: null,
};
export const skill: NamedEntry = {
  id: "protect",
  name: "Protect",
  notes: "Come to an ally’s aid.",
  price: null,
};
export const equipment = {
  id: sword.id,
  name: sword.name,
  notes: "A well-used blade.",
  price: 50,
  itemType: "weapon",
  weapon: { attributes: ["DEX", "MIG"], accuracyBonus: 1, equipped: true },
} satisfies NamedEntry;
export const sheetMaximum = { HP: 35, MP: 35, IP: 6 };
export const baseDefense = { DEF: 12, "MAG DEF": 8, INIT: 0 };
export const defenseDetails = {
  DEF: [
    { name: "DEX", value: 8 },
    { name: "Equipment", value: 4, modifier: true },
  ],
  "MAG DEF": [{ name: "INS", value: 8 }],
  INIT: [],
};

export function makeCharacter(): Character {
  return structuredClone({
    id: partyMember.id,
    identity: { name: partyMember.name, theme: "Duty" },
    level: 5,
    editingLocked: false,
    classes: [guardian],
    skills: [skill],
    attributes: { DEX: "8", INS: "8", MIG: "10", WLP: "6" },
    equipment: [equipment],
    current: { HP: 28, MP: 24, IP: 5, Fabula: 3 },
    overrides: { DEF: null, "MAG DEF": null, INIT: null },
  });
}

export function makeThrow(
  kind: "weapon-accuracy" | "opposed-check" | "free",
  canRemove = true,
): ThrowRecord {
  const opposed = kind === "opposed-check";
  const weapon = kind === "weapon-accuracy";
  const dice =
    kind === "free"
      ? [{ label: null, size: 20 }]
      : [
          { label: "DEX", size: 8 },
          { label: "MIG", size: 10 },
        ];
  const redDice = opposed
    ? [
        { label: null, size: 8 },
        { label: null, size: 8 },
      ]
    : [];
  const modifier = weapon ? 1 : 0;
  const note = weapon ? "Defending the crossing." : "";

  return {
    id: kind,
    seq: 1,
    createdAt: characterSummary.createdAt,
    kind,
    role: "GM",
    characterId: partyMember.id,
    characterName: partyMember.name,
    equipmentId: weapon ? sword.id : null,
    equipmentName: weapon ? sword.name : null,
    setup: {
      type: weapon ? "weapon" : opposed ? "attribute" : "free",
      kind,
      characterId: partyMember.id,
      equipmentId: weapon ? sword.id : null,
      dice,
      redDice,
      modifier,
      redModifier: 0,
      note,
      weaponBonus: weapon ? 1 : null,
      accuracyDice: weapon ? ["DEX", "MIG"] : null,
    },
    outcome: {
      first: {
        dice: dice.map((die) => ({ ...die, face: 6 })),
        modifier,
        total: dice.length * 6 + modifier,
        result: kind === "free" ? "none" : "critical",
      },
      ...(opposed
        ? {
            second: {
              dice: redDice.map((die) => ({ ...die, face: 6 })),
              modifier: 0,
              total: 12,
              result: "critical" as const,
            },
            winner: "tie" as const,
          }
        : {}),
    },
    canRemove,
  };
}
