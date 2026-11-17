import { and, eq } from "drizzle-orm";
import type { Database } from "../../database/types.ts";
import { characterSkillRanks, gameClassSkills } from "../../database/schema.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";

/** Read learned definitions for the GM's scoped sheet projection. */
export function learnedSkills(
  database: Database,
  accessFor: GameAccessFactory,
  actor: GameActor,
  gameId: string,
  id: string,
) {
  return database.transaction(
    async (tx) => {
      const access = await accessFor(tx).gameAccess(actor, gameId);
      if (access?.role !== "GM")
        throw Object.assign(new Error("Game unavailable"), { code: "not_found" });
      return tx
        .select({
          name: gameClassSkills.name,
          description: gameClassSkills.description,
          rank: characterSkillRanks.rank,
          benefits: gameClassSkills.benefits,
        })
        .from(characterSkillRanks)
        .innerJoin(
          gameClassSkills,
          and(
            eq(gameClassSkills.id, characterSkillRanks.skillId),
            eq(gameClassSkills.gameId, characterSkillRanks.gameId),
          ),
        )
        .where(and(eq(characterSkillRanks.gameId, gameId), eq(characterSkillRanks.characterId, id)))
        .orderBy(gameClassSkills.id)
        .limit(100);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
