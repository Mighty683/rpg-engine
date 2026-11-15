/** Prototype-only transaction boundary; both views project the same revisioned records. */
import { HttpResponse } from "msw";
import type { Character } from "../../src/modules/characters/types";
import type { Sheet } from "../../src/modules/characters/sheet/types";
import type {
  ProgressionBenefit,
  ProgressionCharacter,
  ProgressionClass,
  ProgressionSave,
  ProgressionSnapshot,
} from "../../src/modules/class-progression/types";
import {
  characterLevelError,
  experienceError,
  progressionError,
  withProgressionRanks,
} from "../../src/modules/class-progression/model";
import { prototypeStore as store, projectParty } from "./store";
import { isClassModifierStat } from "../../src/shared/fabula/classModifiers";
import type { BenefitDraft } from "../../src/modules/class-management/types";

function benefitEffect(benefit: BenefitDraft): ProgressionBenefit {
  const stat = isClassModifierStat(benefit.stat) ? benefit.stat : undefined;
  const amount = Number(benefit.amount);
  const automatic =
    benefit.kind === "modifier" && stat && benefit.amount.trim() && Number.isInteger(amount);
  return {
    ...benefit,
    description:
      benefit.description ||
      (benefit.kind === "modifier" ? `${benefit.stat} ${benefit.amount}` : ""),
    stat: automatic ? stat : undefined,
    amount: automatic ? amount : undefined,
  };
}

function gameCatalog(): ProgressionClass[] {
  return store.gameClasses.map((entry) => ({
    ...entry,
    benefits: entry.benefits.map(benefitEffect),
    skills: entry.skills
      .filter((skill) => skill.name.trim())
      .map((skill) => ({
        ...skill,
        maxRank: Math.max(1, Math.floor(Number(skill.maxRank)) || 1),
        benefits: skill.benefits.map(benefitEffect),
      })),
  }));
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

function snapshot(): ProgressionSnapshot {
  const catalog = gameCatalog();
  return {
    catalog,
    characters:
      store.scenario === "empty"
        ? []
        : store.progressionCharacters.map((character) => project(character, catalog)),
  };
}
export function handleProgression(path: string, method: string, body: Record<string, unknown>) {
  if (method === "GET" && path === "/api/prototype/class-progression")
    return HttpResponse.json(snapshot());
  const character = store.progressionCharacters.find(
    (entry) => entry.id === path.split("/").at(-1),
  );
  if (method !== "POST" || !character)
    return HttpResponse.json({ error: { message: "Character not found." } }, { status: 404 });
  const input = body as unknown as ProgressionSave;
  if (input.expectedRevision !== character.revision)
    return HttpResponse.json(
      {
        error: {
          message: "This character changed. Refresh saved data before choosing ranks again.",
        },
      },
      { status: 409 },
    );
  if (!input.ranks || typeof input.ranks !== "object" || Array.isArray(input.ranks))
    return HttpResponse.json({ error: { message: "Choose skill ranks." } }, { status: 400 });
  if (!input.levels || typeof input.levels !== "object" || Array.isArray(input.levels))
    return HttpResponse.json({ error: { message: "Choose class levels." } }, { status: 400 });
  if (!input.experience || typeof input.experience !== "object")
    return HttpResponse.json(
      { error: { message: "Enter current and total EXP." } },
      { status: 400 },
    );
  const error =
    characterLevelError(input.level) ??
    progressionError(gameCatalog(), input.levels, input.ranks) ??
    experienceError(input.experience, input.levels);
  if (error) return HttpResponse.json({ error: { message: error } }, { status: 400 });
  store.progressionLevels[character.id] = structuredClone(input.levels);
  store.progressionRanks[character.id] = structuredClone(input.ranks);
  store.progressionExperience.set(character.id, structuredClone(input.experience));
  character.level = input.level;
  character.sheet.level = input.level;
  character.revision += 1;
  return HttpResponse.json(snapshot());
}
