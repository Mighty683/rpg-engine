import type { Character as FabulaSheet } from "../../src/modules/characters/sheet/types";

export type Role = "GM" | "Player";
export type Resource = "HP" | "MP" | "IP";
export const gmControl = "gm-control";

export type Character = {
  id: string;
  sheet: FabulaSheet;
  maximumOverrides: Record<Resource, number | null>;
  controllerId: string | null;
  gmActive: boolean;
};

export type Member = {
  userId: string;
  activeCharacterId: string | null;
  removed: boolean;
};

export type Invitation = {
  id: string;
  characterId: string | null;
  enabled: boolean;
  spent: boolean;
};

export type InvitationStatus = "Enabled" | "Disabled" | "Assigned" | "Used" | "Unavailable";

export type Game = {
  id: string;
  name: string;
  system: string;
  gmId: string;
  members: Member[];
  characters: Character[];
  invitations: Invitation[];
};

export type Option = { id: string; label: string };
export type GameSummary = Pick<Game, "id" | "name" | "system"> & { role: Role };

export type CharacterView = Character & {
  controller: string;
  editable: boolean;
  active: boolean;
};

export type InvitationRow = Invitation & {
  title: string;
  status: InvitationStatus;
  url: string;
};
