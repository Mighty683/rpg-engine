import { tr } from "../../shared/i18n";
import type { Benefit, BenefitDraft, ClassDefinition, RemovalImpact, StoredClass } from "./types";
import { isClassModifierStat } from "../../shared/fabula/classModifiers";

export function completeDefinition(entry: ClassDefinition): boolean {
  const hasName = (name: string) => Boolean(name.trim()) && name.length <= 100;
  const boundedText = (text: string) => text.length <= 2000;
  const completeBenefit = (benefit: BenefitDraft) =>
    hasName(benefit.name) &&
    boundedText(benefit.description) &&
    (benefit.kind === "text"
      ? Boolean(benefit.description.trim())
      : isClassModifierStat(benefit.stat) &&
        Boolean(benefit.amount.trim()) &&
        Number.isInteger(Number(benefit.amount)) &&
        Number(benefit.amount) >= -2147483648 &&
        Number(benefit.amount) <= 2147483647);
  return (
    hasName(entry.name) &&
    boundedText(entry.description) &&
    entry.benefits.length <= 10 &&
    entry.benefits.every(completeBenefit) &&
    entry.skills.length <= 30 &&
    entry.skills.every(
      (skill) =>
        hasName(skill.name) &&
        boundedText(skill.description) &&
        Number.isInteger(Number(skill.maxRank)) &&
        Number(skill.maxRank) >= 1 &&
        Number(skill.maxRank) <= 2147483647 &&
        skill.benefits.length <= 10 &&
        skill.benefits.every(completeBenefit),
    )
  );
}

function encodeBenefit(draft: BenefitDraft, wireId: (id: string) => string): Benefit {
  const base = { id: wireId(draft.id), name: draft.name, description: draft.description };
  if (draft.kind === "text") return { ...base, kind: "text" };
  if (!isClassModifierStat(draft.stat)) throw new Error(tr("ui.chooseAModifierStat"));
  return {
    ...base,
    kind: "modifier",
    stat: draft.stat,
    amount: Number(draft.amount),
    perRank: draft.perRank,
  };
}

export function encodeClass(entry: ClassDefinition, wireId = (id: string) => id): StoredClass {
  return {
    id: wireId(entry.id),
    revision: entry.revision ?? 0,
    systemId: "fabula-ultima",
    definition: {
      name: entry.name,
      description: entry.description,
      freeBenefits: entry.benefits.map((benefit) => encodeBenefit(benefit, wireId)),
      skills: entry.skills.map((skill) => ({
        ...skill,
        id: wireId(skill.id),
        maxRank: Number(skill.maxRank),
        benefits: skill.benefits.map((benefit) => encodeBenefit(benefit, wireId)),
      })),
    },
  };
}

function decodeBenefit(benefit: Benefit, viewId: (id: string) => string): BenefitDraft {
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

export function decodeClass(record: StoredClass, viewId = (id: string) => id): ClassDefinition {
  return {
    id: viewId(record.id),
    revision: record.revision,
    name: record.definition.name,
    description: record.definition.description,
    benefits: record.definition.freeBenefits.map((benefit) => decodeBenefit(benefit, viewId)),
    skills: record.definition.skills.map((skill) => ({
      ...skill,
      id: viewId(skill.id),
      maxRank: String(skill.maxRank),
      benefits: skill.benefits.map((benefit) => decodeBenefit(benefit, viewId)),
    })),
  };
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
