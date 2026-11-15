/** Prototype-only transaction boundary; both views project the same revisioned records. */
import { HttpResponse } from "msw";
import type { Character } from "../../src/modules/characters/types";
import { projectDefenses } from "../../src/modules/characters/sheet/defense/model";
import type { Sheet } from "../../src/modules/characters/sheet/types";
import type {
  ProgressionCharacter,
  ProgressionClass,
} from "../../src/modules/class-progression/types";
import {
  characterLevelError,
  CLASS_LEVEL_EXP_COST,
  totalRanks,
  experienceError,
  progressionError,
  withProgressionRanks,
} from "../../src/modules/class-progression/model";
import { prototypeStore as store, projectParty, seedCharacter } from "./store";
import { classError } from "./class-catalog";
import {
  classGamePath,
  encodeClass,
  wireCatalog,
  classLevels,
  skillRanks,
  levelsById,
  ranksById,
  wireId,
  viewId,
} from "../class-management/contract";
import type { CharacterChanges } from "../class-management/contract";
function gameCatalog(): ProgressionClass[] {
  return wireCatalog(store.gameClasses.map(encodeClass));
}

function project(character: Character, catalog: ProgressionClass[]): ProgressionCharacter {
  const ranks = store.progressionRanks[character.id] ?? {};
  const levels = store.progressionLevels[character.id] ?? {};
  const sheet = structuredClone(character.sheet) as Sheet;
  const party = { ...projectParty(character), canRoll: false };
  const experience = store.progressionExperience.get(character.id) ?? { current: 50, total: 50 };
  return withProgressionRanks(
    catalog,
    { id: character.id, revision: character.revision, levels, ranks, experience, sheet, party },
    ranks,
    levels,
  );
}

function availableCharacters() {
  return store.scenario === "empty" ? [] : store.progressionCharacters;
}

function canEdit(character: Character, player: string | null) {
  return (
    !player || (store.progressionControllers.get(character.id) ?? character.id) === viewId(player)
  );
}

function readCharacter(character: Character, player: string | null) {
  const projected = project(character, gameCatalog());
  const raw = character.sheet as Sheet;
  const editable = canEdit(character, player);
  const currentDice = projected.party.currentDice ?? raw.baseDice;
  const defenses = projectDefenses(raw, currentDice);
  const defenseValues = {
    defense: projected.party.defense ?? null,
    magicDefense: projected.party.magicDefense ?? null,
    initiative: defenses.initiative.calculated,
  };
  return HttpResponse.json({
    character: {
      ...character,
      id: wireId(character.id),
      playerId: wireId(character.playerId),
      canEdit: editable,
      sheet: {
        ...raw,
        classes: raw.classes.map((entry) => ({ ...entry, id: wireId(entry.id) })),
        skills: raw.skills.map((entry) => ({ ...entry, id: wireId(entry.id) })),
        equipment: raw.equipment.map((entry) => ({ ...entry, id: wireId(entry.id) })),
      },
      derived: {
        coverage: "partial",
        currentDice,
        maxima: projected.party.maxima,
        defenses: Object.fromEntries(
          Object.entries(defenses).map(([name, value]) => {
            const calculated = defenseValues[name as keyof typeof defenseValues];
            const contributions = value.contributions.map((entry) => ({
              ...entry,
              entryId: entry.entryId ? wireId(entry.entryId) : undefined,
            }));
            return [
              name,
              calculated === null
                ? { calculated, reason: "ambiguous_equipment" }
                : { calculated, contributions },
            ];
          }),
        ),
      },
      progression: editable
        ? {
            experience: projected.experience,
            classLevels: classLevels(projected.levels),
            skillRanks: skillRanks(projected.ranks),
          }
        : undefined,
    },
  });
}

function party() {
  const catalog = gameCatalog();
  return HttpResponse.json({
    characters: availableCharacters().map((character) => {
      const { party } = project(character, catalog);
      return {
        ...party,
        id: wireId(party.id),
        weapons: party.weapons.map((weapon) => ({ ...weapon, id: wireId(weapon.id) })),
      };
    }),
  });
}

function roster(player: string | null) {
  return HttpResponse.json({
    characters: availableCharacters().map((character) => ({
      id: wireId(character.id),
      name: character.name,
      level: character.level,
      createdAt: character.createdAt,
      active: true,
      canEdit: canEdit(character, player),
      controllerMembershipId: wireId(character.playerId),
      controllerName: null,
    })),
  });
}

function create(payload: Record<string, unknown>, player: string | null) {
  const { id, name } = payload;
  if (typeof id !== "string" || typeof name !== "string" || !name.trim() || name.length > 100)
    return classError(422, "validation", "Enter a character name.", {
      name: "Enter 1–100 characters.",
    });
  const existing = store.progressionCharacters.find((character) => character.id === id);
  if (existing) {
    if (canEdit(existing, player) && store.progressionCreates.get(id) === name)
      return readCharacter(existing, player);
    return classError(409, "id_conflict", "The character ID was already used.");
  }
  const character = seedCharacter(id, name, false);
  character.sheet.classes = [];
  character.sheet.equipment = [];
  if (player) store.progressionControllers.set(id, viewId(player));
  store.progressionCharacters.push(character);
  store.progressionCreates.set(id, name);
  const response = readCharacter(character, player);
  return new HttpResponse(response.body, { status: 201, headers: response.headers });
}

function patch(character: Character, payload: Record<string, unknown>, player: string | null) {
  if (!canEdit(character, player))
    return classError(403, "forbidden", "You can edit only your own character.");
  if (payload.expectedRevision !== character.revision)
    return classError(409, "stale_revision", "The character changed. Refresh saved data.");
  const changes = payload.changes as CharacterChanges;
  if (!changes || !Object.keys(changes).length)
    return classError(400, "bad_request", "Supply character changes.");
  const progression = changes.progression;
  if (
    progression &&
    (!Object.keys(progression).length ||
      (progression.classLevels !== undefined && !Array.isArray(progression.classLevels)) ||
      (progression.skillRanks !== undefined && !Array.isArray(progression.skillRanks)))
  )
    return classError(400, "bad_request", "Supply valid allocations.");
  const previousLevels = store.progressionLevels[character.id] ?? {};
  const previousRanks = store.progressionRanks[character.id] ?? {};
  const previousExperience = store.progressionExperience.get(character.id) ?? {
    current: 50,
    total: 50,
  };
  const levels = progression?.classLevels ? levelsById(progression.classLevels) : previousLevels;
  const ranks = progression?.skillRanks ? ranksById(progression.skillRanks) : previousRanks;
  if (
    (progression?.classLevels && Object.keys(levels).length !== progression.classLevels.length) ||
    (progression?.skillRanks && Object.keys(ranks).length !== progression.skillRanks.length) ||
    progression?.classLevels?.some((entry) => entry.level < 1) ||
    progression?.skillRanks?.some((entry) => entry.rank < 1)
  )
    return classError(422, "validation", "Use unique IDs and positive allocations.", {
      progression: "Check class levels and skill ranks.",
    });
  const before = progression?.experience ?? previousExperience;
  const cost = (totalRanks(levels) - totalRanks(previousLevels)) * CLASS_LEVEL_EXP_COST;
  const experience = { current: before.current - cost, total: before.total };
  const level = changes.level ?? character.level;
  const error =
    characterLevelError(level) ??
    progressionError(gameCatalog(), levels, ranks) ??
    experienceError(before, {}) ??
    experienceError(experience, levels);
  if (error) return classError(422, "validation", error, { progression: error });
  store.progressionLevels[character.id] = levels;
  store.progressionRanks[character.id] = ranks;
  store.progressionExperience.set(character.id, experience);
  character.level = level;
  character.sheet.level = level;
  character.revision += 1;
  return readCharacter(character, player);
}

export function handleProgression(
  path: string,
  method: string,
  body: Record<string, unknown>,
  player: string | null,
) {
  const root = `${classGamePath}/characters`;
  if (path === `${classGamePath}/party` && method === "GET") return party();
  if (path === root && method === "GET") return roster(player);
  if (path === root && method === "POST") return create(body, player);
  const id = path.startsWith(`${root}/`) ? viewId(path.slice(root.length + 1)) : "";
  const character = availableCharacters().find((entry) => entry.id === id);
  if (character && method === "GET") return readCharacter(character, player);
  if (character && method === "PATCH") return patch(character, body, player);
  return classError(404, "not_found", "Character not found.");
}
