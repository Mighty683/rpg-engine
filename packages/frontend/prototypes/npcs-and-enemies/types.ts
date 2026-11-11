/** Contracts for the NPC table composition and its prototype-only endpoints. */
import type { Attribute } from "../../src/modules/game-table/types";
import type { Tag } from "./tags";
export type NpcRank = "Soldier" | "Elite" | "Champion";
export type NpcVisibility = "hidden" | "visible" | "known";

export type DamageType =
  | "physical"
  | "air"
  | "bolt"
  | "dark"
  | "earth"
  | "fire"
  | "ice"
  | "light"
  | "poison";

export type NpcAttack = {
  id: string;
  name: string;
  range: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  /** Fixed damage bonus; total damage is high roll + this bonus. */
  damageBonus: number;
  damageType: string;
};

export type NpcAbility = {
  id: string;
  name: string;
  description: string;
};

export type Npc = {
  id: string;
  name: string;
  level: number;
  rank: NpcRank;
  visibility?: NpcVisibility;
  baseDice: { DEX: number; INS: number; MIG: number; WLP: number };
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  crisis: number;
  defense: number;
  magicDefense: number;
  initiative: number;
  attacks: NpcAttack[];
  abilities: NpcAbility[];
  vulnerabilities: DamageType[];
  resistances: DamageType[];
  immunities: DamageType[];
  statusImmunities: string[];
  tags: Tag[];
  notes: string;
};

export type TableRole = "GM" | "Player";
export type TableScenario =
  | "Mixed"
  | "Characters only"
  | "NPCs only"
  | "Empty"
  | "Loading"
  | "Error";
export interface NpcApi {
  list(): Promise<{ npcs: Npc[]; tags: Tag[] }>;
  save(npc: Npc, tags: Tag[]): Promise<{ npc: Npc }>;
  saveCharacterTags(id: string, tags: Tag[]): Promise<{ tags: Tag[] }>;
}
