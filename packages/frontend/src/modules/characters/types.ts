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

export type GameCharacterSummary = {
  id: string;
  name: string;
  level: number;
  controllerMembershipId: string | null;
  controllerName: string | null;
  canEdit: boolean;
  active: boolean;
  createdAt: string;
};

export type CharacterSummary = {
  id: string;
  playerId: string;
  name: string;
  level: number;
  createdAt: string;
};

export type Character = CharacterSummary & {
  systemId: "fabula-ultima";
  updatedAt: string;
  revision: number;
  sheet: Record<string, unknown>;
  derived: Record<string, unknown>;
};
