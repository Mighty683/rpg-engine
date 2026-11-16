/** Catalog progression constraints and display projections for managed character progression. */
import type { BenefitDraft, ClassDefinition } from "../class-management/types";
import { isClassModifierStat, type ClassModifierStat } from "../../shared/fabula/classModifiers";
import { projectDefenses } from "../characters/sheet/defense/model";
import type { Sheet } from "../characters/sheet/types";
import type {
  ManagedAbilities,
  ManagedProgression,
  ProgressionClass,
  ProgressionExperience,
  SourcedBenefit,
} from "./types";

export const MAX_CHARACTER_CLASSES = 5;
export const CLASS_LEVEL_EXP_COST = 10;

export function assignedRanks(entry: ProgressionClass, ranks: Record<string, number>): number {
  return entry.skills.reduce((total, skill) => total + (ranks[skill.id] ?? 0), 0);
}
export function totalRanks(ranks: Record<string, number>): number {
  return Object.values(ranks).reduce((total, rank) => total + rank, 0);
}
export function experienceError(
  experience: ProgressionExperience,
  levels: Record<string, number>,
): string | undefined {
  if (!Number.isInteger(experience.current) || !Number.isInteger(experience.total))
    return "Enter whole numbers for current and total EXP.";
  if (experience.current < 0 || experience.total < 0) return "EXP cannot be negative.";
  if (Math.max(experience.current, experience.total) > 2147483647)
    return "EXP must be at most 2147483647.";
  if (experience.current > experience.total) return "Total EXP must cover current EXP.";
  if (experience.total - experience.current < totalRanks(levels) * CLASS_LEVEL_EXP_COST)
    return "Total EXP must cover current EXP and the cost of assigned class levels.";
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

export function projectClassStats(sheet: Sheet, benefits: SourcedBenefit[]) {
  const bonus = (stat: ClassModifierStat) =>
    benefits.reduce((sum, benefit) => sum + (benefit.stat === stat ? benefit.total : 0), 0);
  const clamp = (value: number, min = 0, max = 2147483647) => Math.min(max, Math.max(min, value));
  const stepDie = (base: number, steps: number) => clamp(base + 2 * steps, 6, 12);
  const currentDice = {
    DEX: stepDie(sheet.baseDice.DEX, bonus("dieDex")),
    INS: stepDie(sheet.baseDice.INS, bonus("dieIns")),
    MIG: stepDie(sheet.baseDice.MIG, bonus("dieMig")),
    WLP: stepDie(sheet.baseDice.WLP, bonus("dieWlp")),
  };
  const equipment = projectDefenses(sheet, currentDice);
  const defenseWithBonus = (defense: typeof equipment.defense, value = 0) =>
    defense.calculated === null
      ? defense
      : {
          calculated: clamp(defense.calculated + value, -2147483648),
          contributions: value
            ? [...defense.contributions, { source: "class", value: clamp(value, -2147483648) }]
            : defense.contributions,
        };
  const defenses = {
    defense: defenseWithBonus(equipment.defense, bonus("defense")),
    magicDefense: defenseWithBonus(equipment.magicDefense, bonus("magicDefense")),
    initiative: defenseWithBonus(equipment.initiative),
  };
  return {
    currentDice,
    maxima: {
      hp: clamp((sheet.overrides.maxHp ?? sheet.level + 5 * sheet.baseDice.MIG) + bonus("maxHp")),
      mp: clamp((sheet.overrides.maxMp ?? sheet.level + 5 * sheet.baseDice.WLP) + bonus("maxMp")),
      ip: clamp((sheet.overrides.maxIp ?? 6) + bonus("maxIp")),
    },
    defenses,
  };
}

function toProgressionBenefit(benefit: BenefitDraft) {
  const { id, name, description } = benefit;
  return {
    id,
    name,
    description,
    ...(benefit.kind === "modifier" && isClassModifierStat(benefit.stat)
      ? { stat: benefit.stat, amount: Number(benefit.amount), perRank: benefit.perRank }
      : {}),
  };
}
export function toProgressionClass(entry: ClassDefinition): ProgressionClass {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    benefits: entry.benefits.map(toProgressionBenefit),
    skills: entry.skills.map((skill) => ({
      ...skill,
      maxRank: Number(skill.maxRank),
      benefits: skill.benefits.map(toProgressionBenefit),
    })),
  };
}
export function managedAbilities(progression: ManagedProgression): ManagedAbilities {
  return {
    experience: progression.experience,
    levels: Object.fromEntries(
      progression.classLevels.map(({ gameClassId, level }) => [gameClassId, level]),
    ),
    ranks: Object.fromEntries(progression.skillRanks.map(({ skillId, rank }) => [skillId, rank])),
  };
}
export function previewManagedProgression(
  current: ManagedProgression,
  changes: Partial<ManagedProgression>,
): ManagedProgression {
  const classLevels = changes.classLevels ?? current.classLevels;
  const sum = (levels: ManagedProgression["classLevels"]) =>
    levels.reduce((total, entry) => total + entry.level, 0);
  const balance = changes.experience ?? current.experience;
  return {
    classLevels,
    skillRanks: changes.skillRanks ?? current.skillRanks,
    experience: {
      total: balance.total,
      current:
        balance.current - CLASS_LEVEL_EXP_COST * (sum(classLevels) - sum(current.classLevels)),
    },
  };
}
