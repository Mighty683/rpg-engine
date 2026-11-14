import type { npcs, npcAttacks } from "../../database/schema.ts";
import type { GameEvents } from "../events/types.ts";
import type { GameActor, GameAccessFactory } from "../games/types.ts";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
export type Attribute = "DEX" | "INS" | "MIG" | "WLP";
export type Die = 6 | 8 | 10 | 12;
export type NpcAttack = {
  id: string;
  name: string;
  reach: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  damageBonus: number;
  damageType: string;
};
export type NpcWrite = {
  name: string;
  relationship: "enemy" | "neutral" | "friend";
  level: number;
  visibility: "hidden" | "visible" | "known";
  baseDice: Record<Attribute, Die>;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  defense: number;
  magicDefense: number;
  attacks: NpcAttack[];
  notes: string;
};

export type CreateNpcInput = { id: string; npc: NpcWrite };
export type UpdateNpcInput = { expectedRevision: number; npc: NpcWrite };
export type RemoveNpcInput = { expectedRevision: number };

export type NpcIdentity = { id: string; name: string; relationship: string };
export type NpcProfile = NpcIdentity & {
  level: number;
  baseDice: Record<Attribute, number>;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  defense: number;
  magicDefense: number;
  attacks: {
    id: string;
    name: string;
    reach: string;
    attributes: string[];
    damageBonus: number;
    damageType: string;
  }[];
};
export type NpcRecord =
  | ({ view: "visible" } & NpcIdentity)
  | ({ view: "known" } & NpcProfile)
  | ({
      view: "gm";
      visibility: string;
      notes: string;
      revision: number;
      createdAt: string;
      updatedAt: string;
    } & NpcProfile);
export interface NpcsService {
  read(actor: GameActor, gameId: string, id?: string): Promise<NpcRecord[]>;
  write(
    actor: GameActor,
    gameId: string,
    id: string,
    npc: NpcWrite,
    expectedRevision?: number,
  ): Promise<{ npc: NpcRecord | null; created: boolean }>;
  remove(actor: GameActor, gameId: string, id: string, expectedRevision: number): Promise<void>;
}
export type NpcRollProfile = {
  id: string;
  name: string;
  revision: number;
  level: number;
  dexDie: number;
  insDie: number;
  migDie: number;
  wlpDie: number;
};
export type NpcRollAttack = {
  id: string;
  name: string;
  attribute1: string;
  attribute2: string;
  damageBonus: number;
  damageType: string;
};
export interface NpcRollReader {
  profile(gameId: string, id: string): Promise<NpcRollProfile | null>;
  attack(npcId: string, id: string): Promise<NpcRollAttack | null>;
}
export type NpcRollReaderFactory = (tx: DatabaseTransaction) => NpcRollReader;

export type NpcRow = typeof npcs.$inferSelect;
export type NpcAttackRow = typeof npcAttacks.$inferSelect;
export type NpcDependencies = {
  database: Database;
  gameAccessFor: GameAccessFactory;
  events: GameEvents;
};
