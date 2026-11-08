import type { attributes, dieSizes } from "./model";

export type ThrowResult = {
  id: string;
  character: string;
  actor?: string;
  weapon: string;
  weaponBonus?: number;
  dice: { attribute: string; size: number; face: number }[];
  bonus: number;
  total: number;
  special: string;
  note?: string;
  opponent?: OpposedRoll;
  opposedSides?: [OpposedSide, OpposedSide];
  outcome?: string;
  tied?: boolean;
};

export type OpponentDraft = { dice: number[]; modifier: string };

export type Attribute = (typeof attributes)[number];

export type DieSize = (typeof dieSizes)[number];

export type Resource = { current: number; max: number };

export type PartyMember = {
  id: string;
  name: string;
  controller: string;
  hp: Resource;
  mp: Resource;
  ip: Resource;
  fabula: number;
  baseDice: Record<Attribute, DieSize>;
};

export type CheckDraft = {
  first: Attribute;
  second: Attribute;
  dice: Record<Attribute, DieSize>;
  modifier: number | undefined;
  difficulty: number | undefined;
};

export type CheckResult = {
  character: string;
  dice: readonly [CheckDie, CheckDie];
  modifier: number;
  difficulty: number;
  total: number;
  outcome: "Fumble" | "Critical success" | "Success" | "Failure";
};

export type CheckDie = { attribute: Attribute; size: DieSize; face: number };

export type OpposedSide = {
  name: string;
  dice: { attribute: string; size: number }[];
  modifier: number;
};

export type OpposedRoll = {
  name: string;
  dice: { attribute: string; size: number; face: number }[];
  bonus: number;
  total: number;
  special: string;
};
