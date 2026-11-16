import { and, eq, inArray, sql } from "drizzle-orm";
import { characterClassLevels, characterSkillRanks, characters } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { ClassProgressionStore } from "./types.ts";

export function createClassProgressionStore(tx: DatabaseTransaction): ClassProgressionStore {
  const ranksFor = (gameId: string, classId: string) =>
    and(eq(characterSkillRanks.gameId, gameId), eq(characterSkillRanks.gameClassId, classId));
  const assignmentsFor = (gameId: string, classId: string) =>
    and(eq(characterClassLevels.gameId, gameId), eq(characterClassLevels.gameClassId, classId));

  return {
    learnedSkills: (gameId, classId) =>
      tx
        .select({
          skillId: characterSkillRanks.skillId,
          characterId: characterSkillRanks.characterId,
          name: characters.name,
          rank: characterSkillRanks.rank,
        })
        .from(characterSkillRanks)
        .innerJoin(
          characters,
          and(eq(characters.id, characterSkillRanks.characterId), eq(characters.gameId, gameId)),
        )
        .where(ranksFor(gameId, classId))
        .orderBy(characterSkillRanks.skillId, characterSkillRanks.characterId),
    async hasAssignments(gameId, classId) {
      const [row] = await tx
        .select({ id: characterClassLevels.characterId })
        .from(characterClassLevels)
        .where(assignmentsFor(gameId, classId))
        .limit(1);
      return Boolean(row);
    },
    async removeRanks(gameId, classId, skillIds) {
      if (skillIds.length)
        await tx
          .delete(characterSkillRanks)
          .where(and(ranksFor(gameId, classId), inArray(characterSkillRanks.skillId, skillIds)));
    },
    async reviseAssignedCharacters(gameId, classId) {
      const assigned = tx
        .select({ id: characterClassLevels.characterId })
        .from(characterClassLevels)
        .where(assignmentsFor(gameId, classId));
      const rows = await tx
        .update(characters)
        .set({ revision: sql`${characters.revision} + 1`, updatedAt: sql`now()` })
        .where(and(eq(characters.gameId, gameId), inArray(characters.id, assigned)))
        .returning({ id: characters.id });
      return rows.map(({ id }) => id);
    },
  };
}
