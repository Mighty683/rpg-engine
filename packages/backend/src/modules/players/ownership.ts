/** Membership mutations and selection revisions bound to one game transaction. */
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { players, accounts } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { MembershipOwnership } from "./types.ts";
const fields = {
  id: players.id,
  accountId: players.accountId,
  name: players.name,
  removed: players.removed,
  activeCharacterId: players.activeCharacterId,
  revision: players.revision,
};
const fail = () => Object.assign(new Error("not_found"), { code: "not_found" });
export function createMembershipOwnership(tx: DatabaseTransaction): MembershipOwnership {
  return {
    async find(gameId, id) {
      const [row] = await tx
        .select(fields)
        .from(players)
        .where(and(eq(players.gameId, gameId), eq(players.id, id)));
      return row ?? null;
    },
    async forAccount(gameId, accountId) {
      const [row] = await tx
        .select(fields)
        .from(players)
        .where(and(eq(players.gameId, gameId), eq(players.accountId, accountId)));
      return row ?? null;
    },
    async create(gameId, accountId) {
      const [account] = await tx
        .select({ name: sql<string>`left(${accounts.username},20)` })
        .from(accounts)
        .where(eq(accounts.id, accountId));
      if (!account) throw fail();
      const id = randomUUID();
      await tx.insert(players).values({ id, gameId, accountId, name: account.name });
      return id;
    },
    async clearCharacter(gameId, id) {
      await tx
        .update(players)
        .set({ activeCharacterId: null, revision: sql`${players.revision}+1` })
        .where(and(eq(players.gameId, gameId), eq(players.activeCharacterId, id)));
    },
    async clearMember(gameId, id) {
      await tx
        .update(players)
        .set({
          activeCharacterId: null,
          revision: sql`${players.revision} + CASE WHEN ${players.activeCharacterId} IS NULL THEN 0 ELSE 1 END`,
        })
        .where(and(eq(players.gameId, gameId), eq(players.id, id)));
    },
    async select(gameId, id, characterId, onlyIfEmpty = false) {
      await tx
        .update(players)
        .set({ activeCharacterId: characterId, revision: sql`${players.revision}+1` })
        .where(
          and(
            eq(players.gameId, gameId),
            eq(players.id, id),
            onlyIfEmpty
              ? isNull(players.activeCharacterId)
              : sql`${players.activeCharacterId} IS DISTINCT FROM ${characterId}`,
          ),
        );
    },
    async setRemoved(gameId, id, removed) {
      const [row] = await tx
        .update(players)
        .set({ removed })
        .where(and(eq(players.gameId, gameId), eq(players.id, id)))
        .returning(fields);
      if (!row) throw fail();
      return row;
    },
  };
}
