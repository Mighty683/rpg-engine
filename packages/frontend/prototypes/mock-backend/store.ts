/** Deterministic in-memory prototype data. All HTTP projections share these sheets. */
import type { Character } from "../../src/modules/characters/types";
import type { Sheet } from "../../src/modules/characters/sheet/types";
import type { PartyCharacter } from "../../src/modules/game-table/types";
import { allNpcs } from "../npcs-and-enemies/fixtures";
import { makeThrow, members } from "../domain/fixtures";
import type { PrototypeScenario } from "./types";
import { projectDefenses } from "./defenses";

const timestamp = "2026-01-01T00:00:00Z";

function seedCharacter(id: string, name: string, caster: boolean): Character {
  const sheet: Sheet = {
    name,
    theme: caster ? "Discovery" : "Duty",
    level: 5,
    baseDice: { DEX: 8, INS: caster ? 10 : 8, MIG: caster ? 6 : 10, WLP: 8 },
    classes: [
      {
        id: caster ? "elementalist" : "guardian",
        name: caster ? "Elementalist" : "Guardian",
        notes: "",
      },
    ],
    skills: [],
    equipment: caster
      ? []
      : [
          {
            id: "longsword",
            name: "Longsword",
            notes: "",
            kind: "weapon",
            priceZenit: 50,
            equipped: true,
            accuracyDice: ["DEX", "MIG"],
            accuracyBonus: 1,
          },
        ],
    resources: caster ? { hp: 16, mp: 32, ip: 3, fabula: 2 } : { hp: 28, mp: 24, ip: 5, fabula: 3 },
    overrides: {
      maxHp: null,
      maxMp: null,
      maxIp: null,
      defense: null,
      magicDefense: null,
      initiative: null,
    },
  };
  return {
    id,
    playerId: "member-nera",
    name,
    level: 5,
    systemId: "fabula-ultima",
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    sheet,
    derived: {},
  };
}

function initialState() {
  return {
    scenario: "default" as PrototypeScenario,
    characterTags: {} as Record<string, import("../../src/shared/types").Tag[]>,
    characters: [
      seedCharacter("rowan", "Rowan Ash", false),
      seedCharacter("nera", "Nera Vale", true),
    ],
    npcs: structuredClone(allNpcs),
    tags: structuredClone([
      ...new Map(allNpcs.flatMap((npc) => npc.tags).map((tag) => [tag.name, tag])).values(),
    ]),
    throws: [makeThrow("weapon-accuracy"), makeThrow("opposed-check")],
    members: structuredClone(members),
  };
}

export const prototypeStore = initialState();

export function resetPrototypeBackend(scenario: PrototypeScenario = "default") {
  Object.assign(prototypeStore, initialState(), { scenario });
}

export function setPrototypeScenario(scenario: PrototypeScenario) {
  prototypeStore.scenario = scenario;
}

export function projectParty(character: Character): PartyCharacter {
  const sheet = character.sheet as Sheet;
  return {
    id: character.id,
    revision: character.revision,
    name: sheet.name,
    level: sheet.level,
    classes: sheet.classes.map((entry) => entry.name),
    baseDice: sheet.baseDice,
    resources: sheet.resources,
    maxima: {
      hp: sheet.overrides.maxHp ?? sheet.level + sheet.baseDice.MIG * 5,
      mp: sheet.overrides.maxMp ?? sheet.level + sheet.baseDice.WLP * 5,
      ip: sheet.overrides.maxIp ?? 6,
    },
    defense: sheet.overrides.defense ?? projectDefenses(sheet).defense.calculated,
    magicDefense: sheet.overrides.magicDefense ?? projectDefenses(sheet).magicDefense.calculated,
    canRoll: true,
    tags: prototypeStore.characterTags[character.id] ?? [],
    weapons: sheet.equipment
      .filter((item) => item.kind === "weapon")
      .map((item) => ({
        id: item.id,
        name: item.name,
        equipped: item.equipped ?? false,
        accuracyDice: item.accuracyDice ?? [null, null],
        accuracyBonus: item.accuracyBonus ?? null,
        ...Object.fromEntries(
          ["reach", "damageBonus", "damageType"]
            .filter((key) => key in item)
            .map((key) => [key, (item as unknown as Record<string, unknown>)[key]]),
        ),
        ready: Boolean(
          item.accuracyDice?.[0] && item.accuracyDice?.[1] && item.accuracyBonus != null,
        ),
      })),
  };
}

export function projectCharacter(character: Character): Character {
  const party = projectParty(character);
  const sheet = character.sheet as Sheet;
  return {
    ...character,
    name: sheet.name,
    level: sheet.level,
    derived: {
      maxima: party.maxima,
      defenses: projectDefenses(sheet),
    },
  };
}
