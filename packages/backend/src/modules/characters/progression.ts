import { and, eq, inArray } from "drizzle-orm";
import {
  characterClassLevels,
  characterSkillRanks,
  gameClasses,
  gameClassSkills,
} from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { ClassBenefit } from "../class-catalog/types.ts";
import type { ActiveModifier } from "../fabula/types.ts";
import type {
  ClassLevel,
  ManagedAllocation,
  ManagedClass,
  ManagedSkill,
  Progression,
  Row,
  SkillRank,
} from "./types.ts";

function addEntry<T extends { characterId: string }>(
  allocations: Map<string, ManagedAllocation>,
  entry: T,
  add: (allocation: ManagedAllocation, row: T) => void,
) {
  let allocation = allocations.get(entry.characterId);
  if (!allocation) {
    allocation = { classes: [], skills: [] };
    allocations.set(entry.characterId, allocation);
  }
  add(allocation, entry);
}

export async function managedAllocations(tx: DatabaseTransaction, ids: string[]) {
  const allocations = new Map<string, ManagedAllocation>();
  if (!ids.length) return allocations;
  const classes = await tx
    .select({
      characterId: characterClassLevels.characterId,
      gameClassId: gameClasses.id,
      level: characterClassLevels.level,
      name: gameClasses.name,
      freeBenefits: gameClasses.freeBenefits,
    })
    .from(characterClassLevels)
    .innerJoin(
      gameClasses,
      and(
        eq(gameClasses.gameId, characterClassLevels.gameId),
        eq(gameClasses.id, characterClassLevels.gameClassId),
      ),
    )
    .where(inArray(characterClassLevels.characterId, ids))
    .orderBy(gameClasses.id);
  const skills = await tx
    .select({
      characterId: characterSkillRanks.characterId,
      gameClassId: characterSkillRanks.gameClassId,
      skillId: gameClassSkills.id,
      rank: characterSkillRanks.rank,
      benefits: gameClassSkills.benefits,
    })
    .from(characterSkillRanks)
    .innerJoin(
      gameClassSkills,
      and(
        eq(gameClassSkills.gameId, characterSkillRanks.gameId),
        eq(gameClassSkills.id, characterSkillRanks.skillId),
      ),
    )
    .where(inArray(characterSkillRanks.characterId, ids))
    .orderBy(gameClassSkills.id);
  for (const entry of classes)
    addEntry(allocations, entry, (allocation, row) => allocation.classes.push(row));
  for (const entry of skills)
    addEntry(allocations, entry, (allocation, row) => allocation.skills.push(row));
  return allocations;
}

export function progressionFor(row: Row, allocation?: ManagedAllocation): Progression {
  return {
    experience: { current: row.exp_current, total: row.exp_total },
    classLevels:
      allocation?.classes.map(({ gameClassId, level }) => ({ gameClassId, level })) ?? [],
    skillRanks: allocation?.skills.map(({ skillId, rank }) => ({ skillId, rank })) ?? [],
  };
}

export function activeModifiers(allocation?: ManagedAllocation): ActiveModifier[] {
  const modifiers = (benefits: ClassBenefit[], rank?: number) =>
    benefits.flatMap((benefit) =>
      benefit.kind === "modifier"
        ? [{ stat: benefit.stat, value: benefit.amount * (benefit.perRank ? (rank ?? 1) : 1) }]
        : [],
    );
  return [
    ...(allocation?.classes.flatMap((entry) => modifiers(entry.freeBenefits)) ?? []),
    ...(allocation?.skills.flatMap((entry) => modifiers(entry.benefits, entry.rank)) ?? []),
  ];
}

function invalid(field: keyof Progression, message: string): never {
  throw Object.assign(new Error(message), { code: "validation", field: `/progression/${field}` });
}

function normalizeClassLevels(entries: ClassLevel[]) {
  const ids = new Set<string>();
  return entries
    .map(({ gameClassId, level }) => {
      const id = gameClassId.toLowerCase();
      if (ids.has(id)) invalid("classLevels", "Choose each class once.");
      ids.add(id);
      return { gameClassId: id, level };
    })
    .sort((a, b) => a.gameClassId.localeCompare(b.gameClassId));
}

function normalizeSkillRanks(entries: SkillRank[]) {
  const ids = new Set<string>();
  return entries
    .map(({ skillId, rank }) => {
      const id = skillId.toLowerCase();
      if (ids.has(id)) invalid("skillRanks", "Choose each skill once.");
      ids.add(id);
      return { skillId: id, rank };
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId));
}

export async function applyProgression(
  tx: DatabaseTransaction,
  gameId: string,
  characterId: string,
  before: Progression,
  changes: Partial<Progression>,
): Promise<{ progression: Progression; allocation: ManagedAllocation }> {
  const classLevels = normalizeClassLevels(changes.classLevels ?? before.classLevels);
  const skillRanks = normalizeSkillRanks(changes.skillRanks ?? before.skillRanks);
  const used = (levels: ClassLevel[]) => levels.reduce((sum, entry) => sum + entry.level, 0) * 10;
  const balance = changes.experience ?? before.experience;
  if (balance.current > balance.total || balance.total - balance.current < used(before.classLevels))
    invalid("experience", "Total EXP must cover current EXP and the cost of saved class levels.");
  const current = balance.current - (used(classLevels) - used(before.classLevels));
  if (current < 0)
    invalid("experience", "There is not enough current EXP to add those class levels.");
  if (current > balance.total || balance.total - current < used(classLevels))
    invalid(
      "experience",
      "Total EXP must cover current EXP and the cost of assigned class levels.",
    );

  const classes = classLevels.length
    ? await tx
        .select({
          id: gameClasses.id,
          name: gameClasses.name,
          freeBenefits: gameClasses.freeBenefits,
        })
        .from(gameClasses)
        .where(
          and(
            eq(gameClasses.gameId, gameId),
            inArray(
              gameClasses.id,
              classLevels.map((entry) => entry.gameClassId),
            ),
          ),
        )
    : [];
  const classById = new Map(classes.map((entry) => [entry.id, entry]));
  const allocationClasses: ManagedClass[] = classLevels.map((level) => {
    const entry = classById.get(level.gameClassId);
    if (!entry) invalid("classLevels", "Choose classes available in this game.");
    return { ...level, characterId, name: entry.name, freeBenefits: entry.freeBenefits };
  });

  const skills = skillRanks.length
    ? await tx
        .select({
          id: gameClassSkills.id,
          gameClassId: gameClassSkills.gameClassId,
          maxRank: gameClassSkills.maxRank,
          benefits: gameClassSkills.benefits,
        })
        .from(gameClassSkills)
        .where(
          and(
            eq(gameClassSkills.gameId, gameId),
            inArray(
              gameClassSkills.id,
              skillRanks.map((entry) => entry.skillId),
            ),
          ),
        )
    : [];
  const skillById = new Map(skills.map((entry) => [entry.id, entry]));
  const levelById = new Map(classLevels.map((entry) => [entry.gameClassId, entry.level]));
  const usedRanks = new Map<string, number>();
  const allocationSkills: ManagedSkill[] = skillRanks.map((rank) => {
    const skill = skillById.get(rank.skillId);
    if (!skill || rank.rank > skill.maxRank)
      invalid("skillRanks", "Choose valid skill ranks within their limits.");
    const allocated = rank.rank + (usedRanks.get(skill.gameClassId) ?? 0);
    if (allocated > (levelById.get(skill.gameClassId) ?? 0))
      invalid("skillRanks", "Skill ranks cannot exceed their class level.");
    usedRanks.set(skill.gameClassId, allocated);
    return { ...rank, characterId, gameClassId: skill.gameClassId, benefits: skill.benefits };
  });
  return {
    progression: { experience: { current, total: balance.total }, classLevels, skillRanks },
    allocation: { classes: allocationClasses, skills: allocationSkills },
  };
}

export async function replaceManagedAllocation(
  tx: DatabaseTransaction,
  gameId: string,
  characterId: string,
  allocation: ManagedAllocation,
) {
  // The class allocation owns skill ranks; replacing it clears the old ranks in the same transaction.
  await tx
    .delete(characterClassLevels)
    .where(
      and(
        eq(characterClassLevels.gameId, gameId),
        eq(characterClassLevels.characterId, characterId),
      ),
    );
  if (allocation.classes.length)
    await tx.insert(characterClassLevels).values(
      allocation.classes.map(({ gameClassId, level }) => ({
        gameId,
        characterId,
        gameClassId,
        level,
      })),
    );
  if (allocation.skills.length)
    await tx.insert(characterSkillRanks).values(
      allocation.skills.map(({ gameClassId, skillId, rank }) => ({
        gameId,
        characterId,
        gameClassId,
        skillId,
        rank,
      })),
    );
}
