import {
  encodeClass as encode,
  decodeClass as decode,
  ContractError,
} from "../../src/modules/class-management/contract";
export { completeDefinition } from "../../src/modules/class-management/contract";
export { ContractError };
export type { Benefit, Definition, StoredClass } from "../../src/modules/class-management/types";
export const encodeClass = (entry: Parameters<typeof encode>[0]) => encode(entry, wireId);
export const decodeClass = (entry: StoredClass) => decode(entry, viewId);
/** Wire types for the class-management task contract. UI drafts keep their input strings locally. */
import type { Benefit, StoredClass } from "../../src/modules/class-management/types";
import type {
  ProgressionClass,
  ProgressionExperience,
} from "../../src/modules/class-progression/types";
import { progressionCatalog } from "../mock-backend/progression-seed";

export const classGamePath = "/api/games/00000000-0000-4000-8000-000000000001";
export const libraryPath = "/api/library/class";
export const gameClassesPath = `${classGamePath}/classes`;

const fixtureAliases = [
  "catalog-rowan",
  "catalog-nera",
  "catalog-new",
  "member-nera",
  "longsword",
  "armor",
  "shield",
  "lancer",
  "scout",
  ...progressionCatalog.flatMap(({ id, benefits, skills }) => [
    id,
    ...benefits.map((effect) => effect.id),
    ...skills.flatMap((skill) => [skill.id, ...skill.benefits.map((effect) => effect.id)]),
  ]),
];
const fixtureIds = new Map(
  fixtureAliases.map((alias, index) => [
    alias,
    `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
  ]),
);
const aliasesById = new Map([...fixtureIds].map(([alias, id]) => [id, alias]));
export const wireId = (id: string) => fixtureIds.get(id) ?? id;
export const viewId = (id: string) => aliasesById.get(id) ?? id;

function effect(benefit: Benefit) {
  const id = viewId(benefit.id);
  return benefit.kind === "text"
    ? { ...benefit, id }
    : {
        ...benefit,
        id,
        description: benefit.description || `${benefit.stat} ${benefit.amount}`,
      };
}

export function wireCatalog(records: StoredClass[]): ProgressionClass[] {
  return records.map(({ id, definition }) => ({
    id: viewId(id),
    name: definition.name,
    description: definition.description,
    benefits: definition.freeBenefits.map(effect),
    skills: definition.skills.map((skill) => ({
      ...skill,
      id: viewId(skill.id),
      benefits: skill.benefits.map(effect),
    })),
  }));
}

export type LibraryTarget =
  | { mode: "new"; id: string; name: string }
  | { mode: "update"; templateId: string; expectedTemplateRevision: number };
export type Progression = {
  experience: ProgressionExperience;
  classLevels: { gameClassId: string; level: number }[];
  skillRanks: { skillId: string; rank: number }[];
};
export type CharacterChanges = { level?: number; progression?: Partial<Progression> };

export function classLevels(levels: Record<string, number>): Progression["classLevels"] {
  return Object.entries(levels)
    .filter(([, value]) => value > 0)
    .map(([id, level]) => ({ gameClassId: wireId(id), level }));
}

export function skillRanks(ranks: Record<string, number>): Progression["skillRanks"] {
  return Object.entries(ranks)
    .filter(([, value]) => value > 0)
    .map(([id, rank]) => ({ skillId: wireId(id), rank }));
}

export async function contractRequest<T>(
  path: string,
  options: {
    origin?: string;
    playerId?: string;
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${options.origin ?? ""}${path}`, {
    method: options.method,
    headers: {
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json", "x-csrf-token": "prototype-csrf" }),
      ...(options.playerId ? { "x-prototype-character": wireId(options.playerId) } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const { error } = await response.json();
    throw new ContractError(
      response.status,
      error.code,
      error.message ?? "Could not confirm the change.",
      error.impact,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function levelsById(levels: Progression["classLevels"]): Record<string, number> {
  return Object.fromEntries(levels.map(({ gameClassId, level }) => [viewId(gameClassId), level]));
}

export function ranksById(ranks: Progression["skillRanks"]): Record<string, number> {
  return Object.fromEntries(ranks.map(({ skillId, rank }) => [viewId(skillId), rank]));
}
