export type DieSource = (sides: number) => number;

export type RolledDie = { label: string | null; size: number; face: number };

export type CheckResult = "fumble" | "critical" | "ordinary";

export type SideOutcome = {
  dice: RolledDie[];
  modifier: number;
  total: number;
  result: CheckResult | "none";
};

export type OpposedOutcome = {
  first: SideOutcome;
  second: SideOutcome;
  winner: "first" | "second" | "tie";
};

export type AttributePair = [Attribute, Attribute?] | [Attribute];

export type Attribute = "DEX" | "INS" | "MIG" | "WLP";

export type Die = 6 | 8 | 10 | 12;

export type NamedEntry = { id: string; name: string; notes: string };

export type EquipmentEntry = {
  id: string;
  name: string;
  notes: string;
  priceZenit: number | null;
} & (
  | { kind: "other" }
  | {
      kind: "weapon";
      equipped: boolean;
      accuracyDice: [Attribute | null, Attribute | null];
      accuracyBonus: number | null;
    }
  | {
      kind: "armor";
      equipped: boolean;
      fixedDefense: number | null;
      defenseBonus: number;
      magicDefenseBonus: number;
      initiativeModifier: number;
    }
  | {
      kind: "shield";
      equipped: boolean;
      defenseBonus: number;
      magicDefenseBonus: number;
      initiativeModifier: number;
    }
);

export type FabulaSheet = {
  name: string;
  theme: string | null;
  level: number;
  baseDice: Record<Attribute, Die>;
  classes: NamedEntry[];
  skills: NamedEntry[];
  equipment: EquipmentEntry[];
  resources: { hp: number; mp: number; ip: number; fabula: number };
  overrides: {
    maxHp: number | null;
    maxMp: number | null;
    maxIp: number | null;
    defense: number | null;
    magicDefense: number | null;
    initiative: number | null;
  };
};

export type SheetChanges = Partial<Omit<FabulaSheet, "baseDice" | "resources" | "overrides">> & {
  baseDice?: Partial<FabulaSheet["baseDice"]>;
  resources?: Partial<FabulaSheet["resources"]>;
  overrides?: Partial<FabulaSheet["overrides"]>;
};

export type Contribution = {
  source: Attribute | "base" | "armor" | "shield";
  entryId?: string;
  value: number;
};

export type CalculatedDefense =
  | { calculated: number; contributions: Contribution[] }
  | { calculated: null; reason: "ambiguous_equipment" };

export type FabulaPreview = {
  coverage: "partial";
  maxima: { hp: number; mp: number; ip: number };
  defenses: {
    defense: CalculatedDefense;
    magicDefense: CalculatedDefense;
    initiative: CalculatedDefense;
  };
};
