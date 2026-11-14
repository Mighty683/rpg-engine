/** Character ownership operations run on the workflow's transaction and game lock.
 * Roster joins are a read projection; member and invitation mutations stay with their owners. */
import { and, eq, isNull, inArray, sql } from "drizzle-orm";
import { characters, characterFields, players, accounts } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { GameAccess } from "../games/types.ts";
import type { SummaryRow, CharacterOwnership } from "./types.ts";
import { canEditCharacter } from "./access.ts";
export const summary = (row: SummaryRow, access: GameAccess) => ({
  id: row.id,
  name: row.name,
  level: row.level,
  controllerMembershipId: row.player_id,
  controllerName: row.controller_name,
  canEdit: canEditCharacter(access, row.player_id),
  active: row.active,
  createdAt: new Date(row.created_at).toISOString(),
});

export function characterSummaries(tx: DatabaseTransaction, gameId: string, id?: string) {
  return tx
    .select({
      id: characters.id,
      name: characters.name,
      level: characters.level,
      player_id: characters.playerId,
      created_at: characters.createdAt,
      controller_name: accounts.username,
      active: sql<boolean>`CASE WHEN ${characters.playerId} IS NULL THEN ${characters.gmActive} ELSE COALESCE(${players.activeCharacterId}=${characters.id}, false) END`,
    })
    .from(characters)
    .leftJoin(
      players,
      and(eq(players.id, characters.playerId), eq(players.gameId, characters.gameId)),
    )
    .leftJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(eq(characters.gameId, gameId), id ? eq(characters.id, id) : undefined))
    .orderBy(characters.createdAt, characters.id);
}

export function createCharacterOwnership(tx: DatabaseTransaction): CharacterOwnership {
  return {
    async lock(gameId, id) {
      const [row] = await tx
        .select(characterFields)
        .from(characters)
        .where(and(eq(characters.gameId, gameId), eq(characters.id, id)))
        .for("update");
      return row ?? null;
    },
    async unowned(gameId, id) {
      const [row] = await tx
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(eq(characters.gameId, gameId), eq(characters.id, id), isNull(characters.playerId)),
        );
      return !!row;
    },
    async ownedIds(gameId, membershipId) {
      return (
        await tx
          .select({ id: characters.id })
          .from(characters)
          .where(and(eq(characters.gameId, gameId), eq(characters.playerId, membershipId)))
      ).map((row) => row.id);
    },
    async assign(gameId, id, membershipId) {
      await tx
        .update(characters)
        .set({ playerId: membershipId, gmActive: false })
        .where(and(eq(characters.gameId, gameId), eq(characters.id, id)));
    },
    async release(gameId, ids) {
      if (ids.length)
        await tx
          .update(characters)
          .set({ playerId: null, gmActive: false })
          .where(and(eq(characters.gameId, gameId), inArray(characters.id, ids)));
    },
    async summary(gameId, id, access) {
      const [row] = await characterSummaries(tx, gameId, id);
      if (!row) throw Object.assign(new Error("not_found"), { code: "not_found" });
      return summary(row, access);
    },
  };
}
