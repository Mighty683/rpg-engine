/** Authoritative NPC roll projection bound to the caller's game transaction. */
import { and, eq } from "drizzle-orm";
import { npcs, npcAttacks } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { NpcRollReader } from "./types.ts";
export function createNpcRollReader(tx: DatabaseTransaction): NpcRollReader {
  return {
    async profile(gameId, id) {
      const [row] = await tx
        .select()
        .from(npcs)
        .where(and(eq(npcs.gameId, gameId), eq(npcs.id, id)));
      return row ?? null;
    },
    async attack(npcId, id) {
      const [row] = await tx
        .select()
        .from(npcAttacks)
        .where(and(eq(npcAttacks.npcId, npcId), eq(npcAttacks.id, id)));
      return row ?? null;
    },
  };
}
