import type { GameActor, GameAccess } from "../games/types.ts";
import type { createCharactersService } from "./factory.ts";
import type { Attribute, FabulaSheet } from "../fabula/types.ts";

export type CharacterContext = { actor: GameActor; gameId: string; access: GameAccess };

export type CharactersService = ReturnType<typeof createCharactersService>;

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
