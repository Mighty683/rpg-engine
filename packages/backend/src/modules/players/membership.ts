import type { Actor } from "../auth/types.ts";
import type { GameAccessFactory } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";
import { notifyAfterCommit, transaction } from "../../database/transaction.ts";
import type { Database } from "../../database/types.ts";
import { and, eq, exists, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { characters, games, invitations, players } from "../../database/schema.ts";

const memberFields = {
  id: players.id,
  accountId: players.accountId,
  name: players.name,
  removed: players.removed,
  activeCharacterId: players.activeCharacterId,
  revision: players.revision,
};
const failure = (code: string) => Object.assign(new Error(code), { code });

export async function listMembers(database: Database, actor: Actor, gameId: string) {
  const db = database;
  const viewer = alias(players, "viewer");
  const viewerMembership = db
    .select({ id: viewer.id })
    .from(viewer)
    .where(
      and(
        eq(viewer.gameId, games.id),
        eq(viewer.accountId, actor.accountId),
        eq(viewer.removed, false),
      ),
    );
  const permitted = or(
    eq(games.gmAccountId, actor.accountId),
    and(eq(players.removed, false), exists(viewerMembership)),
  );
  return db
    .select(memberFields)
    .from(players)
    .innerJoin(games, eq(games.id, players.gameId))
    .where(and(eq(players.gameId, gameId), permitted))
    .orderBy(players.name, players.id);
}

export async function setMemberRemoved(
  {
    gameAccessFor,
    events,
    database,
  }: { gameAccessFor: GameAccessFactory; events: GameEvents; database: Database },
  actor: Actor,
  gameId: string,
  membershipId: string,
  removed: boolean,
) {
  const result = await transaction(database, async (tx) => {
    const db = tx;
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (access.role !== "GM") throw failure("forbidden");
    const [member] = await db
      .select(memberFields)
      .from(players)
      .where(and(eq(players.id, membershipId), eq(players.gameId, gameId)));
    if (!member) throw failure("not_found");
    if (member.removed === removed) return { member, changed: false };
    if (removed) {
      const owned = db
        .select({ id: characters.id })
        .from(characters)
        .where(and(eq(characters.gameId, gameId), eq(characters.playerId, membershipId)));
      await db.delete(invitations).where(inArray(invitations.characterId, owned));
      await db
        .update(players)
        .set({
          activeCharacterId: null,
          revision: sql`${players.revision} + CASE WHEN ${players.activeCharacterId} IS NULL THEN 0 ELSE 1 END`,
        })
        .where(eq(players.id, membershipId));
      await db
        .update(characters)
        .set({ playerId: null, gmActive: false })
        .where(and(eq(characters.gameId, gameId), eq(characters.playerId, membershipId)));
    }
    const [updated] = await db
      .update(players)
      .set({ removed })
      .where(eq(players.id, membershipId))
      .returning(memberFields);
    return { member: updated!, changed: true };
  });
  if (result.changed) {
    if (removed)
      await notifyAfterCommit(() => events.closeMemberStreams(gameId, result.member.accountId));
    await notifyAfterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
  }
  return result.member;
}

export async function selectPlayerCharacter(
  {
    gameAccessFor,
    events,
    database,
  }: { gameAccessFor: GameAccessFactory; events: GameEvents; database: Database },
  actor: Actor,
  gameId: string,
  expectedRevision: number,
  characterId: string | null,
  targetMembershipId?: string,
) {
  const result = await transaction(database, async (tx) => {
    const db = tx;
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (targetMembershipId && access.role !== "GM") throw failure("forbidden");
    if (!targetMembershipId && access.role !== "Player") throw failure("forbidden");
    const membershipId =
      targetMembershipId ?? (access.role === "Player" ? access.membershipId : null);
    if (!membershipId) throw failure("not_found");
    const [member] = await db
      .select(memberFields)
      .from(players)
      .where(
        and(eq(players.id, membershipId), eq(players.gameId, gameId), eq(players.removed, false)),
      );
    if (!member) throw failure("not_found");
    if (member.revision !== expectedRevision) throw failure("stale_revision");
    if (characterId !== null) {
      const [character] = await db
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(
            eq(characters.id, characterId),
            eq(characters.gameId, gameId),
            eq(characters.playerId, membershipId),
          ),
        );
      if (!character) throw failure("not_found");
    }
    if (member.activeCharacterId === characterId) return { member, changed: false };
    const [updated] = await db
      .update(players)
      .set({ activeCharacterId: characterId, revision: sql`${players.revision}+1` })
      .where(eq(players.id, membershipId))
      .returning(memberFields);
    return { member: updated!, changed: true };
  });
  if (result.changed)
    await notifyAfterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
  return result.member;
}
