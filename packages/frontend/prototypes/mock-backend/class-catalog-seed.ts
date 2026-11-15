import type { BenefitDraft, ClassDefinition } from "../../src/modules/class-management/types";
import type { ProgressionBenefit } from "../../src/modules/class-progression/types";
import { progressionCatalog } from "./progression-seed";

function toDraft(benefit: ProgressionBenefit): BenefitDraft {
  return {
    id: benefit.id,
    name: benefit.name,
    description: benefit.description,
    kind: benefit.stat ? "modifier" : "text",
    stat: benefit.stat ?? "",
    amount: benefit.amount?.toString() ?? "",
    perRank: benefit.perRank,
  };
}

export function seedGameClasses(): ClassDefinition[] {
  return progressionCatalog.map((entry) => ({
    ...entry,
    benefits: entry.benefits.map(toDraft),
    skills: entry.skills.map((skill) => ({
      ...skill,
      maxRank: String(skill.maxRank),
      benefits: skill.benefits.map(toDraft),
    })),
  }));
}
