/** A descriptive or modifier benefit in a class or skill draft. */
export interface BenefitDraft {
  id: string;
  name: string;
  kind: "text" | "modifier";
  description: string;
  stat: string;
  amount: string;
  perRank?: boolean;
}

/** Skill definition draft; rank-dependent effects remain descriptive for now. */
export interface SkillDraft {
  id: string;
  name: string;
  description: string;
  maxRank: string;
  benefits: BenefitDraft[];
}

export interface ClassDefinition {
  id: string;
  name: string;
  description: string;
  benefits: BenefitDraft[];
  skills: SkillDraft[];
}

export interface ClassUsage {
  id: string;
  name: string;
  levels: Record<string, number>;
  ranks: Record<string, number>;
}

export interface ClassCatalog {
  library: ClassDefinition[];
  game: ClassDefinition[];
  characters: ClassUsage[];
}

export type ClassCatalogChange =
  | { kind: "put"; scope: "library" | "game"; entry: ClassDefinition }
  | { kind: "copy"; from: string; id: string }
  | { kind: "remove-class"; id: string }
  | { kind: "remove-skill"; classId: string; skillId: string; confirmedCharacters: string[] };

export interface ClassCatalogApi {
  load(): Promise<ClassCatalog>;
  save(changes: ClassCatalogChange[]): Promise<ClassCatalog>;
}
