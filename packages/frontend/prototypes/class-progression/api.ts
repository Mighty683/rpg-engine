import type { Sheet } from "../../src/modules/characters/sheet/types";
import type { PartyCharacter } from "../../src/modules/game-table/types";
import {
  CLASS_LEVEL_EXP_COST,
  totalRanks,
  withProgressionRanks,
} from "../../src/modules/class-progression/model";
import type {
  ProgressionApi,
  ProgressionCharacter,
  ProgressionClass,
  ProgressionSnapshot,
} from "../../src/modules/class-progression/types";
import {
  classGamePath,
  gameClassesPath,
  classLevels,
  skillRanks,
  levelsById,
  ranksById,
  wireId,
  viewId,
  contractRequest,
  wireCatalog,
} from "../class-management/contract";
import type { CharacterChanges, Progression, StoredClass } from "../class-management/contract";

type SavedCharacter = {
  id: string;
  revision: number;
  sheet: Sheet;
  progression?: Progression;
};

function project(
  record: SavedCharacter,
  party: PartyCharacter,
  catalog: ProgressionClass[],
): ProgressionCharacter | undefined {
  if (!record.progression) return;
  const levels = levelsById(record.progression.classLevels);
  const ranks = ranksById(record.progression.skillRanks);
  const sheet = {
    ...record.sheet,
    equipment: record.sheet.equipment.map((entry) => ({ ...entry, id: viewId(entry.id) })),
  };
  return withProgressionRanks(
    catalog,
    {
      id: viewId(record.id),
      revision: record.revision,
      levels,
      ranks,
      sheet,
      experience: record.progression.experience,
      party: { ...party, revision: record.revision },
    },
    ranks,
    levels,
  );
}

export function createProgressionApi(playerId?: string, origin = ""): ProgressionApi {
  const request = <T>(path: string, method = "GET", body?: unknown) =>
    contractRequest<T>(path, { origin, playerId, method, body });
  const characterPath = (id: string) => `${classGamePath}/characters/${wireId(id)}`;
  let catalog: ProgressionClass[] = [];

  return {
    async load(): Promise<ProgressionSnapshot> {
      const [game, roster, access] = await Promise.all([
        request<{ classes: StoredClass[] }>(gameClassesPath),
        request<{ characters: PartyCharacter[] }>(`${classGamePath}/party`),
        playerId
          ? request<{ characters: { id: string; canEdit: boolean }[] }>(
              `${classGamePath}/characters`,
            )
          : null,
      ]);
      catalog = wireCatalog(game.classes);
      const party = roster.characters.map((member) => ({
        ...member,
        id: viewId(member.id),
        weapons: member.weapons.map((weapon) => ({ ...weapon, id: viewId(weapon.id) })),
      }));
      const editableIds = new Set(
        access?.characters.filter((entry) => entry.canEdit).map((entry) => viewId(entry.id)),
      );
      const own = access ? party.filter((member) => editableIds.has(member.id)) : party;
      const characters = await Promise.all(
        own.map(async (member) => {
          const { character } = await request<{ character: SavedCharacter }>(
            characterPath(member.id),
          );
          return project(character, member, catalog);
        }),
      );
      return {
        catalog,
        party,
        characters: characters.filter((character) => character !== undefined),
      };
    },
    async create(id, name) {
      await request(`${classGamePath}/characters`, "POST", { id, name });
    },
    async save(base, input) {
      const changes: CharacterChanges = {};
      if (input.level !== base.sheet.level) changes.level = input.level;
      const levels = classLevels(input.levels);
      const ranks = skillRanks(input.ranks);
      const progression: Partial<Progression> = {};
      if (JSON.stringify(levels) !== JSON.stringify(classLevels(base.levels)))
        progression.classLevels = levels;
      if (JSON.stringify(ranks) !== JSON.stringify(skillRanks(base.ranks)))
        progression.skillRanks = ranks;

      const cost = (totalRanks(input.levels) - totalRanks(base.levels)) * CLASS_LEVEL_EXP_COST;
      const beforeAllocation = {
        current: input.experience.current + cost,
        total: input.experience.total,
      };
      if (
        beforeAllocation.current !== base.experience.current ||
        beforeAllocation.total !== base.experience.total
      )
        progression.experience = beforeAllocation;
      if (Object.keys(progression).length) changes.progression = progression;
      if (!Object.keys(changes).length) return base;

      const { character } = await request<{ character: SavedCharacter }>(
        characterPath(base.id),
        "PATCH",
        {
          expectedRevision: input.expectedRevision,
          changes,
        },
      );
      const saved = project(character, base.party, catalog);
      if (!saved) throw new Error("Saved progression was unavailable.");
      return saved;
    },
  };
}
