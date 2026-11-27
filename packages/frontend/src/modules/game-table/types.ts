import type { ApiSchema } from "@rpg-engine/api-schema";
import type { Tag } from "../../shared/types";

export type FreeDraft = {
  characterId: string;
  dice: number[];
  modifier: string;
  note: string;
};

export type OpponentDraft = { dice: number[]; modifier: string };

export type RollDraft = {
  mode: "attribute" | "weapon";
  character: PartyCharacter;
  weaponId: string | null;
  weaponName: string;
  weaponBonus: number;
  first: Attribute;
  second: Attribute | null;
  dice: Record<Attribute, number>;
  modifier: string;
  note: string;
};

export type Attribute = ApiSchema["Attribute"];

type Die = number;

type ThrowKind = ApiSchema["ThrowKind"];

type SetupDice = { label: string | null; size: number };

type AttributeSetup = {
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

type WeaponSetup = {
  type: "weapon";
  characterId: string;
  equipmentId: string;
  expectedRevision: number;
  dice: [Die, Die];
  modifier: number;
  note: string;
};

type FreeSetup = {
  type: "free";
  characterId: string;
  dice: [Die] | [Die, Die] | number[];
  modifier: number;
  redDice: number[];
  redModifier: number;
  note: string;
};

type NpcAttributeSetup = Omit<AttributeSetup, "type" | "characterId"> & {
  type: "npc-attribute";
  npcId: string;
};
type NpcAttackSetup = Omit<WeaponSetup, "type" | "characterId" | "equipmentId"> & {
  type: "npc-attack";
  npcId: string;
  attackId: string;
};
export type ThrowSetup =
  | AttributeSetup
  | WeaponSetup
  | FreeSetup
  | NpcAttributeSetup
  | NpcAttackSetup;

export type CreateThrowInput = {
  agentTurnId?: string;
  sourceThrowId: string | null;
  private?: boolean;
  setup: ThrowSetup;
};

type CharacterResolvedSetup = {
  type: "attribute" | "weapon" | "free";
  kind: ThrowKind;
  characterId: string | null;
  npcId?: string;
  equipmentId: string | null;
  dice: SetupDice[];
  modifier: number;
  redDice: SetupDice[];
  redModifier: number;
  note: string;
  weaponBonus: number | null;
  accuracyDice: [Attribute, Attribute] | null;
};

type NpcResolvedSetup = {
  type: "npc-attribute" | "npc-attack";
  kind: ThrowKind;
  npcId: string;
  npcName: string;
  attributes: [Attribute, Attribute?];
  dice: SetupDice[];
  modifier: number;
  redDice: SetupDice[];
  redModifier: number;
  note: string;
  attack: null | {
    id: string;
    name: string;
    accuracyBonus: number;
    damageBonus: number;
    damageType: string;
  };
  characterId?: never;
  equipmentId?: never;
  weaponBonus?: never;
  accuracyDice?: never;
};
type ResolvedSetup = CharacterResolvedSetup | NpcResolvedSetup;

export type SideOutcomeJson = ApiSchema["ThrowSide"];

export type ThrowRecord = Omit<ApiSchema["Throw"], "setup"> & { setup: ResolvedSetup };

export type PartyWeapon = {
  id: string;
  name: string;
  equipped: boolean;
  accuracyDice: [Attribute | null, Attribute | null];
  accuracyBonus: number | null;
  reach?: "melee" | "ranged" | null;
  damageBonus?: number | null;
  damageType?: string | null;
  ready: boolean;
};

export type PartyCharacter = {
  id: string;
  revision: number;
  name: string;
  level?: number | null;
  classes: string[];
  classSummary?: { name: string; level: number | null }[];
  baseDice: Record<Attribute, number>;
  currentDice?: Record<Attribute, number>;
  resources: { hp: number; mp: number; ip: number; fabula: number };
  maxima: { hp: number; mp: number; ip: number };
  defense: number | null;
  magicDefense: number | null;
  weapons: PartyWeapon[];
  canRoll: boolean;
  tags?: Tag[];
};
