/** Catalog progression constraints and display projections shared by the prototype boundary. */
import type { ClassModifierStat } from "../../shared/fabula/classModifiers";
import { projectDefenses } from "../characters/sheet/defense/model";
import type { Sheet } from "../characters/sheet/types";
import type { ProgressionClass, ProgressionCharacter, SourcedBenefit } from "./types";

export const MAX_CHARACTER_CLASSES = 5;

export function assignedRanks(entry: ProgressionClass, ranks: Record<string, number>): number {
  return entry.skills.reduce((total, skill) => total + (ranks[skill.id] ?? 0), 0);
}
export function totalRanks(ranks: Record<string, number>): number {
  return Object.values(ranks).reduce((total, rank) => total + rank, 0);
}
export function progressionError(
  catalog: ProgressionClass[],
  levels: Record<string, number>,
  ranks: Record<string, number>,
): string | undefined {
  const skills = catalog.flatMap((entry) => entry.skills);
  if (
    Object.entries(ranks).some(
      ([id, rank]) =>
        !Number.isInteger(rank) ||
        rank < 0 ||
        rank > (skills.find((skill) => skill.id === id)?.maxRank ?? -1),
    )
  )
    return "Choose valid skill ranks within their limits.";
  if (
    Object.entries(levels).some(
      ([id, level]) =>
        !catalog.some((entry) => entry.id === id) ||
        !Number.isInteger(level) ||
        level < 0 ||
        level > 10,
    )
  )
    return "Choose valid class levels from 0 to 10.";
  if (Object.values(levels).filter((level) => level > 0).length > MAX_CHARACTER_CLASSES)
    return `A character can have up to ${MAX_CHARACTER_CLASSES} classes.`;
  if (totalRanks(levels) > 50) return "A character cannot exceed level 50.";
  if (catalog.some((entry) => assignedRanks(entry, ranks) > (levels[entry.id] ?? 0)))
    return "Skill ranks cannot exceed their class level.";

  return undefined;
}
export function sourcedBenefits(
  catalog: ProgressionClass[],
  ranks: Record<string, number>,
  levels: Record<string, number>,
): SourcedBenefit[] {
  return catalog.flatMap((entry) => {
    if (!(levels[entry.id] ?? 0)) return [];
    const free = entry.benefits.map((benefit) => ({
      ...benefit,
      source: `${entry.name} · Free benefit`,
      rank: 1,
      maxRank: 1,
      isFree: true,
      total: benefit.amount ?? 0,
    }));
    const learned = entry.skills.flatMap((skill) => {
      const rank = ranks[skill.id] ?? 0;
      if (!rank) return [];
      return skill.benefits.map((benefit) => ({
        ...benefit,
        source: `${entry.name} · ${skill.name} ${rank}/${skill.maxRank}`,
        rank,
        maxRank: skill.maxRank,
        isFree: false,
        total: (benefit.amount ?? 0) * (benefit.perRank ? rank : 1),
      }));
    });
    return [...free, ...learned];
  });
}

function classStats(sheet: Sheet, benefits: SourcedBenefit[]) {
  const bonus = (stat: ClassModifierStat) =>
    benefits.reduce((sum, benefit) => sum + (benefit.stat === stat ? benefit.total : 0), 0);
  const stepDie = (base: number, steps: number) => Math.min(12, Math.max(6, base + 2 * steps));
  const currentDice = {
    DEX: stepDie(sheet.baseDice.DEX, bonus("dieDex")),
    INS: stepDie(sheet.baseDice.INS, bonus("dieIns")),
    MIG: stepDie(sheet.baseDice.MIG, bonus("dieMig")),
    WLP: stepDie(sheet.baseDice.WLP, bonus("dieWlp")),
  };
  const equipment = projectDefenses(sheet, currentDice);
  const physical = equipment.defense.calculated;
  const magical = equipment.magicDefense.calculated;
  return {
    currentDice,
    maxima: {
      hp: Math.max(
        0,
        (sheet.overrides.maxHp ?? sheet.level + 5 * sheet.baseDice.MIG) + bonus("maxHp"),
      ),
      mp: Math.max(
        0,
        (sheet.overrides.maxMp ?? sheet.level + 5 * sheet.baseDice.WLP) + bonus("maxMp"),
      ),
      ip: Math.max(0, (sheet.overrides.maxIp ?? 6) + bonus("maxIp")),
    },
    defense: sheet.overrides.defense ?? (physical === null ? null : physical + bonus("defense")),
    magicDefense:
      sheet.overrides.magicDefense ?? (magical === null ? null : magical + bonus("magicDefense")),
  };
}

/** Derives both saved and optimistic projections from the base sheet and active benefits. */
export function withProgressionRanks(
  catalog: ProgressionClass[],
  character: ProgressionCharacter,
  ranks: Record<string, number>,
  levels: Record<string, number>,
): ProgressionCharacter {
  const level = Math.max(5, totalRanks(levels));
  const classes = catalog
    .filter((entry) => levels[entry.id])
    .map((entry) => ({
      id: entry.id,
      name: `${entry.name} ${levels[entry.id]}`,
      notes: entry.description,
    }));
  const sheet = {
    ...character.sheet,
    level,
    classes,
    skills: catalog
      .flatMap((entry) => entry.skills)
      .filter((skill) => ranks[skill.id])
      .map((skill) => ({
        id: skill.id,
        name: `${skill.name} ${ranks[skill.id]}/${skill.maxRank}`,
        notes: skill.description,
      })),
  };
  return {
    ...character,
    ranks,
    levels,
    sheet,
    party: {
      ...character.party,
      level,
      classes: classes.map((entry) => entry.name),
      ...classStats(sheet, sourcedBenefits(catalog, ranks, levels)),
    },
  };
}
