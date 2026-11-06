/** Data shapes used by the character setup prototype. */
export type Attribute = "DEX" | "INS" | "MIG" | "WLP";
export type WeaponSettings = {
  attributes: [Attribute | "", Attribute | ""];
  accuracyBonus: number | null;
  equipped?: boolean;
};
export type DefenseKind = "armor" | "shield";
export type ArmorSettings = {
  fixedDefense: number | null;
  physicalBonus: number;
  magicBonus: number;
  initiative: number;
};
export type ShieldSettings = { physicalBonus: number; magicBonus: number; initiative: number };
export type NamedEntry = {
  id: string;
  name: string;
  notes: string;
  price: number | null;
  itemType?: "other" | "weapon" | "armor";
  weapon?: WeaponSettings;
  defenseKind?: DefenseKind;
  equipped?: boolean;
  armor?: ArmorSettings;
  shield?: ShieldSettings;
};
export type Character = {
  id: string;
  identity: { name: string; theme: string };
  level: number;
  editingLocked: boolean;
  classes: NamedEntry[];
  skills: NamedEntry[];
  attributes: { DEX: string; INS: string; MIG: string; WLP: string };
  equipment: NamedEntry[];
  current: { HP: number | null; MP: number | null; IP: number | null; Fabula: number };
  overrides: { DEF: number | null; "MAG DEF": number | null; INIT: number | null };
};
export type Player = {
  id: string;
  name: string;
  activeCharacterId: string | null;
  characters: Character[];
};
export type Game = { id: string; name: string; system: string; players: Player[] };
