import type { Attribute, Die, FabulaSheet, EquipmentEntry } from "../fabula/types.ts";
import type { GameActor } from "../games/types.ts";
import type { createThrowsService } from "./factory.ts";

export type ThrowKind =
  | "attribute-check"
  | "attribute-roll"
  | "weapon-accuracy"
  | "free"
  | "opposed-check"
  | "opposed-roll";

export type SetupDice = { label: string | null; size: number };

export type AttributeSetup = {
  type: "attribute";
  characterId: string;
  expectedRevision: number;
  attributes: [Attribute, Attribute?];
  dice: Partial<Record<Attribute, Die>>;
  modifier: number;
  redDice: Die[];
  redModifier: number;
  note: string;
};

export type WeaponSetup = {
  type: "weapon";
  characterId: string;
  equipmentId: string;
  expectedRevision: number;
  dice: [Die, Die];
  modifier: number;
  note: string;
};

export type FreeSetup = {
  type: "free";
  characterId: string;
  dice: [Die] | [Die, Die] | number[];
  modifier: number;
  redDice: number[];
  redModifier: number;
  note: string;
};

export type ThrowSetup = AttributeSetup | WeaponSetup | FreeSetup;

export type CreateThrowInput = {
  sourceThrowId: string | null;
  setup: ThrowSetup;
};

export type ResolvedSetup = {
  type: "attribute" | "weapon" | "free";
  kind: ThrowKind;
  characterId: string | null;
  equipmentId: string | null;
  dice: SetupDice[];
  modifier: number;
  redDice: SetupDice[];
  redModifier: number;
  note: string;
  weaponBonus: number | null;
  accuracyDice: [Attribute, Attribute] | null;
};

export type SideOutcomeJson = {
  dice: { label: string | null; size: number; face: number }[];
  modifier: number;
  total: number;
  result: "fumble" | "critical" | "ordinary" | "none";
};

export type OutcomeJson = {
  first: SideOutcomeJson;
  second?: SideOutcomeJson;
  winner?: "first" | "second" | "tie";
};

export type ThrowRecord = {
  id: string;
  seq: number;
  createdAt: string;
  kind: ThrowKind;
  role: "GM" | "Player";
  characterId: string | null;
  characterName: string;
  equipmentId: string | null;
  equipmentName: string | null;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
  canRemove: boolean;
};

export type ThrowContext = { actor: GameActor; gameId: string };

export type ThrowsService = ReturnType<typeof createThrowsService>;

export type RollCharacter = {
  id: string;
  playerId: string | null;
  revision: number;
  name: string;
  sheet: FabulaSheet;
};

export type SourceThrow = {
  kind: ThrowKind;
  setup: ResolvedSetup;
  characterId: string | null;
  equipmentId: string | null;
};

export type ResolutionContext = {
  role: "GM" | "Player";
  membershipId: string | null;
  activeCharacterIds: readonly string[];
  ownActiveCharacterId: string | null;
  character: RollCharacter | null;
  weapon: Extract<EquipmentEntry, { kind: "weapon" }> | null;
  source: SourceThrow | null;
};

export type ResolvedThrow = {
  kind: ThrowKind;
  role: "GM" | "Player";
  characterId: string | null;
  characterName: string;
  equipmentId: string | null;
  equipmentName: string | null;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
};

export type BaseSetup = Omit<ResolvedSetup, "kind">;

export type ThrowRow = {
  id: string;
  game_id: string;
  seq: string | number;
  created_at: Date;
  author_account_id: string;
  role: "GM" | "Player";
  character_id: string | null;
  equipment_id: string | null;
  character_name: string;
  equipment_name: string | null;
  kind: ThrowKind;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
  deleted: boolean;
};
