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
  revision?: number;
  name: string;
  description: string;
  benefits: BenefitDraft[];
  skills: SkillDraft[];
}

export interface ClassCatalog {
  library: ClassDefinition[];
  game: ClassDefinition[];
}

export type ClassCatalogChange =
  | { kind: "put"; scope: "library" | "game"; entry: ClassDefinition }
  | { kind: "copy"; from: string; id: string };

export type RemovalImpact = {
  skillId: string;
  characters: { id: string; name: string; rank: number }[];
}[];
export type SaveLibraryChoice =
  | { mode: "new"; id: string; name: string }
  | { mode: "update"; templateId: string };

export interface ClassCatalogApi {
  load(): Promise<ClassCatalog>;
  save(base: ClassCatalog, changes: ClassCatalogChange[]): Promise<ClassCatalog>;
  updateGameClass(
    base: ClassCatalog,
    entry: ClassDefinition,
    impact?: RemovalImpact,
  ): Promise<ClassCatalog>;
  removeGameClass(base: ClassCatalog, id: string): Promise<ClassCatalog>;
  saveToLibrary(base: ClassCatalog, id: string, choice: SaveLibraryChoice): Promise<ClassCatalog>;
}
