import type { ApiSchema } from "@rpg-engine/api-schema";
import type { Database } from "../../database/types.ts";
import type { GameEventPublisher } from "../events/types.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";

export type ClassModifierStat = ApiSchema["ModifierStat"];
export type ClassBenefit = ApiSchema["Benefit"];
export type ClassSkill = ApiSchema["ClassSkill"];
export type ClassDefinition = ApiSchema["ClassDefinition"];
export type StoredClass = ApiSchema["StoredClass"];
export type CreateTemplate = ApiSchema["CreateTemplate"];
export type UpdateTemplate = ApiSchema["UpdateTemplate"];
export type CopyClass = ApiSchema["CopyClass"];
export type SaveClassToLibrary = ApiSchema["SaveClassToLibrary"];
type ClassCreateResult = { record: StoredClass; created: boolean };
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

export type SkillRemovalImpact = ApiSchema["SkillRemovalImpact"][number];
export type UpdateGameClass = ApiSchema["UpdateGameClass"];
export type DeleteGameClass = ApiSchema["DeleteGameClass"];
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
