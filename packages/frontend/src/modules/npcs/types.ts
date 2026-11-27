import type { ApiSchema } from "@rpg-engine/api-schema";
/** Contracts for the NPC table composition and its prototype-only endpoints. */
import type { Attribute } from "../game-table/types";
import type { Tag } from "../../shared/types";
type NpcVisibility = "hidden" | "visible" | "known";
export type NpcRelationship = "enemy" | "neutral" | "friend";

type DamageType =
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

type NpcAbility = {
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
  baseDice: NpcWrite["baseDice"];
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

export type NpcWrite = ApiSchema["NpcWrite"];
export type GmNpc = ApiSchema["NpcGm"];
export type NpcRead = ApiSchema["Npc"];
