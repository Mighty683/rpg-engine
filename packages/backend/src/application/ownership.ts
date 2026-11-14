/** Cross-domain ownership changes share one game lock and transaction.
 * Owners provide persistence operations; notifications are registered only after successful work. */
import { transaction } from "../database/transaction.ts";
import type { OwnershipDependencies, OwnershipWorkflows } from "./types.ts";
const fail = (code: string) => Object.assign(new Error(code), { code });
export function createOwnershipWorkflows({
  database,
  events,
  gameAccessFor,
  storesFor,
}: OwnershipDependencies): OwnershipWorkflows {
  return {
    assignCharacter(actor, gameId, id, membershipId) {
      return transaction(database, async (tx, afterCommit) => {
        const access = await gameAccessFor(tx).lockGame(actor, gameId);
        if (access.role !== "GM") throw fail("forbidden");
        const { characters, memberships, invitations } = storesFor(tx);
        const character = await characters.lock(gameId, id);
        if (!character) throw fail("not_found");
        if (membershipId) {
          const target = await memberships.find(gameId, membershipId);
          if (!target || target.removed) throw fail("not_found");
        }
        if (character.player_id !== membershipId) {
          await memberships.clearCharacter(gameId, id);
          await invitations.invalidateCharacters(gameId, [id]);
          await characters.assign(gameId, id, membershipId);
          afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
        }
        return characters.summary(gameId, id, access);
      });
    },
    setMemberRemoved(actor, gameId, membershipId, removed) {
      return transaction(database, async (tx, afterCommit) => {
        const access = await gameAccessFor(tx).lockGame(actor, gameId);
        if (access.role !== "GM") throw fail("forbidden");
        const { characters, memberships, invitations } = storesFor(tx);
        const member = await memberships.find(gameId, membershipId);
        if (!member) throw fail("not_found");
        if (member.removed === removed) return member;
        if (removed) {
          const ids = await characters.ownedIds(gameId, membershipId);
          await invitations.invalidateCharacters(gameId, ids);
          await memberships.clearMember(gameId, membershipId);
          await characters.release(gameId, ids);
        }
        const updated = await memberships.setRemoved(gameId, membershipId, removed);
        if (removed) afterCommit(() => events.closeMemberStreams(gameId, updated.accountId));
        afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
        return updated;
      });
    },
    acceptInvitation(actor, token, makeActive = true) {
      return transaction(database, async (tx, afterCommit) => {
        const { characters, memberships, invitations } = storesFor(tx);
        const link = await invitations.lockLink(token);
        if (!link) throw fail("not_found");
        const { gameId } = link;
        if (link.gmAccountId === actor.accountId) {
          if (link.kind === "character") throw fail("forbidden");
          return { gameId };
        }
        const membership = await memberships.forAccount(gameId, actor.accountId);
        if (membership?.removed) throw fail("not_found");
        if (
          link.kind === "character" &&
          (!link.characterId || !(await characters.unowned(gameId, link.characterId)))
        )
          throw fail("not_found");
        const membershipId = membership?.id ?? (await memberships.create(gameId, actor.accountId));
        if (link.kind === "game") {
          if (!membership) afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
          return { gameId };
        }
        if (!link.characterId) throw fail("not_found");
        await characters.assign(gameId, link.characterId, membershipId);
        if (makeActive) await memberships.select(gameId, membershipId, link.characterId);
        await invitations.invalidateCharacters(gameId, [link.characterId]);
        afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
        return { gameId, characterId: link.characterId, active: makeActive };
      });
    },
  };
}
