import type { ApiSchema } from "@rpg-engine/api-schema";
import type { ManagedProgression } from "../class-progression/types";
import type { Sheet } from "./sheet/types";

export type Snapshot = {
  character: {
    revision: number;
    sheet: Sheet;
    derived: Record<string, any>;
    canEdit?: boolean;
    progression?: ManagedProgression;
  };
};

export type CharacterEdit = Record<string, unknown> & { progression?: Partial<ManagedProgression> };

export type GameCharacterSummary = ApiSchema["CharacterSummary"];

export type CharacterSummary = {
  id: string;
  playerId: string;
  name: string;
  level: number;
  createdAt: string;
};

export type Character = ApiSchema["Character"];
