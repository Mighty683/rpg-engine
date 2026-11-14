import type { FabulaPreview } from "../fabula/types.ts";
import type { GameActor, GameAccess } from "../games/types.ts";
import type { Attribute, FabulaSheet, SheetChanges } from "../fabula/types.ts";
import type { characterEquipment } from "../../database/schema.ts";

export type CreateCharacterInput = { id: string; name: string };
export type UpdateCharacterInput = { expectedRevision: number; changes: SheetChanges };
export type CharacterActiveInput = { active: boolean };
export type CharacterControllerInput = { membershipId: string | null };

/** Loaded collections accepted by both single-sheet and batched projection assembly. */
export type SheetCollections = {
  classes: Pick<NamedRow, "id" | "name" | "notes">[];
  skills: Pick<NamedRow, "id" | "name" | "notes">[];
  equipment: EquipmentRow[];
};

export type EquipmentInsert = typeof characterEquipment.$inferInsert;

export type CharacterContext = { actor: GameActor; gameId: string; access: GameAccess };

export type CharacterSummary = {
  id: string;
  name: string;
  level: number;
  controllerMembershipId: string | null;
  controllerName: string | null;
  canEdit: boolean;
  active: boolean;
  createdAt: string;
};
export type CharacterRecord = {
  id: string;
  playerId: string | null;
  name: string;
  level: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  systemId: "fabula-ultima";
  sheet: FabulaSheet;
  derived: FabulaPreview;
  canEdit: boolean;
};
export interface CharactersService {
  assignCharacter(
    actor: GameActor,
    gameId: string,
    id: string,
    membershipId: string | null,
  ): Promise<CharacterSummary>;
  createWorkspaceCharacter(
    actor: GameActor,
    gameId: string,
    id: string,
    name: string,
  ): Promise<{ record: CharacterRecord; created: boolean }>;
  deleteWorkspaceCharacter(actor: GameActor, gameId: string, id: string): Promise<void>;
  getWorkspaceCharacter(actor: GameActor, gameId: string, id: string): Promise<CharacterRecord>;
  listWorkspaceCharacters(actor: GameActor, gameId: string): Promise<CharacterSummary[]>;
  setGmCharacterActive(
    actor: GameActor,
    gameId: string,
    id: string,
    active: boolean,
  ): Promise<CharacterSummary>;
  updateWorkspaceCharacter(
    gameId: string,
    actor: GameActor,
    id: string,
    expected: number,
    changes: SheetChanges,
  ): Promise<CharacterRecord>;
  listActiveParty(actor: GameActor, gameId: string): Promise<{ characters: PartyCharacter[] }>;
}

export type NamedRow = {
  id: string;
  character_id: string;
  name: string;
  notes: string;
  position: number;
};

export type EquipmentRow = NamedRow & {
  kind: string;
  price_zenit: number | null;
  equipped: boolean | null;
  accuracy_attribute_1: string | null;
  accuracy_attribute_2: string | null;
  accuracy_bonus: number | null;
  fixed_defense: number | null;
  defense_bonus: number | null;
  magic_defense_bonus: number | null;
  initiative_modifier: number | null;
};

export type PartyWeapon = {
  id: string;
  name: string;
  equipped: boolean;
  accuracyDice: [Attribute | null, Attribute | null];
  accuracyBonus: number | null;
  ready: boolean;
};

export type PartyCharacter = {
  id: string;
  revision: number;
  name: string;
  classes: string[];
  baseDice: Record<Attribute, number>;
  resources: { hp: number; mp: number; ip: number; fabula: number };
  maxima: { hp: number; mp: number; ip: number };
  defense: number | null;
  magicDefense: number | null;
  weapons: PartyWeapon[];
  canRoll: boolean;
};

export type Sheet = FabulaSheet;

export type Row = {
  id: string;
  player_id: string | null;
  name: string;
  theme: string | null;
  level: number;
  dex_die: number;
  ins_die: number;
  mig_die: number;
  wlp_die: number;
  current_hp: number;
  current_mp: number;
  current_ip: number;
  fabula_points: number;
  max_hp_override: number | null;
  max_mp_override: number | null;
  max_ip_override: number | null;
  defense_override: number | null;
  magic_defense_override: number | null;
  initiative_override: number | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
};

export type SummaryRow = {
  id: string;
  name: string;
  level: number;
  player_id: string | null;
  controller_name: string | null;
  active: boolean;
  created_at: Date;
};

export interface CharacterOwnership {
  lock(gameId: string, id: string): Promise<Row | null>;
  unowned(gameId: string, id: string): Promise<boolean>;
  ownedIds(gameId: string, membershipId: string): Promise<string[]>;
  assign(gameId: string, id: string, membershipId: string | null): Promise<void>;
  release(gameId: string, ids: string[]): Promise<void>;
  summary(gameId: string, id: string, access: GameAccess): Promise<CharacterSummary>;
}
export type RollCharacter = {
  id: string;
  playerId: string | null;
  revision: number;
  name: string;
  sheet: FabulaSheet;
};

export interface CharacterRollReader {
  activeIds(gameId: string): Promise<string[]>;
  ownActiveId(gameId: string, membershipId: string): Promise<string | null>;
  load(gameId: string, id: string): Promise<RollCharacter | null>;
}
