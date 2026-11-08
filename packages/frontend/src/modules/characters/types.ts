import type { Sheet } from "./sheet/types";

export type Snapshot = {
  character: { revision: number; sheet: Sheet; derived: Record<string, any> };
};

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
