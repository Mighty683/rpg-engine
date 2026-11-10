/** Contracts for the NPC table composition and its prototype-only endpoints. */
import type { Npc } from "./fixtures";
import type { Tag } from "./tags";
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
