import type { Database } from "../../database/types.ts";
import type { GameEventPublisher } from "../events/types.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";

export type ClassModifierStat =
  | "maxHp"
  | "maxMp"
  | "maxIp"
  | "defense"
  | "magicDefense"
  | "dieDex"
  | "dieIns"
  | "dieMig"
  | "dieWlp";
export type ClassBenefit =
  | { id: string; name: string; kind: "text"; description: string }
  | {
      id: string;
      name: string;
      kind: "modifier";
      description?: string;
      stat: ClassModifierStat;
      amount: number;
      perRank?: boolean;
    };
export type ClassSkill = {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  benefits: ClassBenefit[];
};
export type ClassDefinition = {
  name: string;
  description: string;
  freeBenefits: ClassBenefit[];
  skills: ClassSkill[];
};
export type StoredClass = {
  id: string;
  systemId: "fabula-ultima";
  revision: number;
  definition: ClassDefinition;
};
export type CreateTemplate = Omit<StoredClass, "revision">;
export type UpdateTemplate = { expectedRevision: number; definition: ClassDefinition };
export type CopyClass = { id: string; templateId: string; expectedTemplateRevision: number };
export type SaveClassToLibrary = {
  expectedRevision: number;
  target:
    | { mode: "new"; id: string; name: string }
    | { mode: "update"; templateId: string; expectedTemplateRevision: number };
};
export type ClassCreateResult = { record: StoredClass; created: boolean };
export type CatalogDependencies = {
  database: Database;
  gameAccessFor: GameAccessFactory;
  events: GameEventPublisher;
};
export interface ClassCatalogService {
  listTemplates(actor: GameActor): Promise<StoredClass[]>;
  createTemplate(actor: GameActor, input: CreateTemplate): Promise<ClassCreateResult>;
  updateTemplate(actor: GameActor, id: string, input: UpdateTemplate): Promise<StoredClass>;
  listGameClasses(actor: GameActor, gameId: string): Promise<StoredClass[]>;
  copyClass(actor: GameActor, gameId: string, input: CopyClass): Promise<ClassCreateResult>;
  saveToLibrary(
    actor: GameActor,
    gameId: string,
    id: string,
    input: SaveClassToLibrary,
  ): Promise<ClassCreateResult>;
}

export type SkillRemovalImpact = {
  skillId: string;
  characters: { id: string; name: string; rank: number }[];
};
export type UpdateGameClass = UpdateTemplate & { confirmedSkillRemovals?: SkillRemovalImpact[] };
export type DeleteGameClass = Pick<UpdateTemplate, "expectedRevision">;
export interface GameClassEdits {
  updateGameClass(
    actor: GameActor,
    gameId: string,
    id: string,
    input: UpdateGameClass,
  ): Promise<StoredClass>;
  removeGameClass(
    actor: GameActor,
    gameId: string,
    id: string,
    input: DeleteGameClass,
  ): Promise<void>;
}

export interface GameClassStore {
  read(gameId: string, id: string): Promise<StoredClass | undefined>;
  replace(gameId: string, existing: StoredClass, definition: ClassDefinition): Promise<StoredClass>;
  remove(gameId: string, id: string): Promise<void>;
}
