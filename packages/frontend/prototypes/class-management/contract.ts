/** Wire types for the class-management task contract. UI drafts keep their input strings locally. */
import type {
  BenefitDraft,
  ClassDefinition,
  RemovalImpact,
} from "../../src/modules/class-management/types";
import type {
  ProgressionClass,
  ProgressionExperience,
} from "../../src/modules/class-progression/types";
import { isClassModifierStat } from "../../src/shared/fabula/classModifiers";
import type { ClassModifierStat } from "../../src/shared/fabula/classModifiers";
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

type BenefitIdentity = { id: string; name: string };
export type Benefit =
  | (BenefitIdentity & { kind: "text"; description: string })
  | (BenefitIdentity & {
      kind: "modifier";
      description?: string;
      stat: ClassModifierStat;
      amount: number;
      perRank?: boolean;
    });
export type Definition = {
  name: string;
  description: string;
  freeBenefits: Benefit[];
  skills: { id: string; name: string; description: string; maxRank: number; benefits: Benefit[] }[];
};
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

export type StoredClass = {
  id: string;
  revision: number;
  systemId: "fabula-ultima";
  definition: Definition;
};
export type LibraryTarget =
  | { mode: "new"; id: string; name: string }
  | { mode: "update"; templateId: string; expectedTemplateRevision: number };
export type Progression = {
  experience: ProgressionExperience;
  classLevels: { gameClassId: string; level: number }[];
  skillRanks: { skillId: string; rank: number }[];
};
export type CharacterChanges = { level?: number; progression?: Partial<Progression> };

export function completeDefinition(entry: ClassDefinition): boolean {
  const hasName = (name: string) => Boolean(name.trim()) && name.length <= 100;
  const completeBenefit = (benefit: BenefitDraft) =>
    hasName(benefit.name) &&
    (benefit.kind === "text"
      ? Boolean(benefit.description.trim())
      : isClassModifierStat(benefit.stat) &&
        Boolean(benefit.amount.trim()) &&
        Number.isInteger(Number(benefit.amount)) &&
        Number(benefit.amount) >= -2147483648 &&
        Number(benefit.amount) <= 2147483647);
  return (
    hasName(entry.name) &&
    entry.benefits.every(completeBenefit) &&
    entry.skills.every(
      (skill) =>
        hasName(skill.name) &&
        Number.isInteger(Number(skill.maxRank)) &&
        Number(skill.maxRank) >= 1 &&
        Number(skill.maxRank) <= 2147483647 &&
        skill.benefits.every(completeBenefit),
    )
  );
}

function encodeBenefit(draft: BenefitDraft): Benefit {
  const base = { id: wireId(draft.id), name: draft.name, description: draft.description };
  if (draft.kind === "text") return { ...base, kind: "text" };
  if (!isClassModifierStat(draft.stat)) throw new Error("Choose a modifier stat.");
  return {
    ...base,
    kind: "modifier",
    stat: draft.stat,
    amount: Number(draft.amount),
    perRank: draft.perRank,
  };
}

export function encodeClass(entry: ClassDefinition): StoredClass {
  return {
    id: wireId(entry.id),
    revision: entry.revision ?? 0,
    systemId: "fabula-ultima",
    definition: {
      name: entry.name,
      description: entry.description,
      freeBenefits: entry.benefits.map(encodeBenefit),
      skills: entry.skills.map((skill) => ({
        ...skill,
        id: wireId(skill.id),
        maxRank: Number(skill.maxRank),
        benefits: skill.benefits.map(encodeBenefit),
      })),
    },
  };
}

function decodeBenefit(benefit: Benefit): BenefitDraft {
  return {
    id: viewId(benefit.id),
    name: benefit.name,
    description: benefit.description ?? "",
    kind: benefit.kind,
    stat: benefit.kind === "modifier" ? benefit.stat : "",
    amount: benefit.kind === "modifier" ? String(benefit.amount) : "",
    perRank: benefit.kind === "modifier" ? benefit.perRank : undefined,
  };
}

export function decodeClass(record: StoredClass): ClassDefinition {
  return {
    id: viewId(record.id),
    revision: record.revision,
    name: record.definition.name,
    description: record.definition.description,
    benefits: record.definition.freeBenefits.map(decodeBenefit),
    skills: record.definition.skills.map((skill) => ({
      ...skill,
      id: viewId(skill.id),
      maxRank: String(skill.maxRank),
      benefits: skill.benefits.map(decodeBenefit),
    })),
  };
}

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

export class ContractError extends Error {
  readonly status: number;
  readonly code: string;
  readonly impact?: RemovalImpact;

  constructor(status: number, code: string, message: string, impact?: RemovalImpact) {
    super(message);
    this.status = status;
    this.code = code;
    this.impact = impact;
  }
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
