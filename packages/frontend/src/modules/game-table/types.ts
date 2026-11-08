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

export type Attribute = "DEX" | "INS" | "MIG" | "WLP";

export type Die = number;

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
