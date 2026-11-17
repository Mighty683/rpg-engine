/** Contracts for the NPC table composition and its prototype-only endpoints. */
import type { Attribute } from "../game-table/types";
import type { Tag } from "./tags";
export type NpcVisibility = "hidden" | "visible" | "known";
export type NpcRelationship = "enemy" | "neutral" | "friend";

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
  relationship?: NpcRelationship;
  level: number;
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
  remove(id: string): Promise<void>;
  saveCharacterTags(id: string, tags: Tag[]): Promise<{ tags: Tag[] }>;
}

export type NpcAttackRecord = {
  id: string;
  name: string;
  reach: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  damageBonus: number;
  damageType: string;
};
export type NpcProfile = {
  name: string;
  relationship: "enemy" | "neutral" | "friend";
  level: number;
  baseDice: Record<Attribute, number>;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  defense: number;
  magicDefense: number;
  attacks: NpcAttackRecord[];
};
export type NpcWrite = NpcProfile & { visibility: "hidden" | "visible" | "known"; notes: string };
export type GmNpc = NpcWrite & {
  view: "gm";
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type NpcRead =
  | GmNpc
  | ({ view: "known"; id: string } & NpcProfile)
  | { view: "visible"; id: string; name: string; relationship: NpcProfile["relationship"] };
