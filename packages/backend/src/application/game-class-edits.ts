import { isDeepStrictEqual } from "node:util";
import { transaction } from "../database/transaction.ts";
import type { DatabaseTransaction } from "../database/types.ts";
import type { LearnedClassSkill } from "../modules/characters/types.ts";
import type { GameClassEdits, SkillRemovalImpact } from "../modules/class-catalog/types.ts";
import type { GameActor } from "../modules/games/types.ts";
import type { GameClassEditDependencies } from "./types.ts";

const failure = (code: string) => Object.assign(new Error(code), { code });

function removalImpact(learned: LearnedClassSkill[], nextCaps: Map<string, number>) {
  const affected = new Map<string, SkillRemovalImpact["characters"]>();
  for (const { skillId, characterId, name, rank } of learned) {
    const cap = nextCaps.get(skillId);
    if (cap !== undefined) {
      if (rank > cap) throw failure("skill_rank_in_use");
      continue;
    }
    const characters = affected.get(skillId) ?? [];
    characters.push({ id: characterId, name, rank });
    affected.set(skillId, characters);
  }
  return [...affected].map(([skillId, characters]) => ({ skillId, characters }));
}

function confirmedRanks(impact: SkillRemovalImpact[]) {
  return impact
    .map(({ skillId, characters }) => ({
      skillId,
      characters: characters
        .map(({ id, rank }) => ({ id, rank }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.skillId.localeCompare(right.skillId));
}

export function createGameClassEdits({
  database,
  events,
  gameAccessFor,
  classesFor,
  progressionFor,
}: GameClassEditDependencies): GameClassEdits {
  async function editContext(
    tx: DatabaseTransaction,
    actor: GameActor,
    gameId: string,
    id: string,
    revision: number,
  ) {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (access.role !== "GM") throw failure("forbidden");
    const catalog = classesFor(tx);
    const existing = await catalog.read(gameId, id);
    if (!existing) throw failure("not_found");
    if (existing.revision !== revision) throw failure("stale_revision");
    return { catalog, existing, progression: progressionFor(tx) };
  }

  return {
    updateGameClass(actor, gameId, id, input) {
      return transaction(database, async (tx, afterCommit) => {
        const { catalog, existing, progression } = await editContext(
          tx,
          actor,
          gameId,
          id,
          input.expectedRevision,
        );
        const learned = await progression.learnedSkills(gameId, id);
        const caps = new Map(input.definition.skills.map(({ id, maxRank }) => [id, maxRank]));
        const impact = removalImpact(learned, caps);
        if (
          !isDeepStrictEqual(
            confirmedRanks(impact),
            confirmedRanks(input.confirmedSkillRemovals ?? []),
          )
        )
          throw Object.assign(failure("skill_removal_confirmation_required"), { impact });

        await progression.removeRanks(
          gameId,
          id,
          impact.map(({ skillId }) => skillId),
        );
        const updated = await catalog.replace(gameId, existing, input.definition);
        const affected = await progression.reviseAssignedCharacters(gameId, id);
        afterCommit(() => {
          for (const characterId of affected)
            events.publishGameEvent(gameId, { type: "sheet", characterId });
          events.publishGameEvent(gameId, { type: "roster" });
        });
        return updated;
      });
    },
    removeGameClass(actor, gameId, id, input) {
      return transaction(database, async (tx, afterCommit) => {
        const { catalog, progression } = await editContext(
          tx,
          actor,
          gameId,
          id,
          input.expectedRevision,
        );
        if (await progression.hasAssignments(gameId, id)) throw failure("class_in_use");
        await catalog.remove(gameId, id);
        afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
      });
    },
  };
}
