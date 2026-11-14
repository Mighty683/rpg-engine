/** Invitation lookup rechecks the link after acquiring its game's transaction lock. */
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { invitations, games } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { InvitationOwnership } from "./types.ts";
export function createInvitationOwnership(tx: DatabaseTransaction): InvitationOwnership {
  return {
    async lockLink(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const digest = createHash("sha256").update(token).digest();
      const [found] = await tx
        .select({ gameId: invitations.gameId })
        .from(invitations)
        .where(eq(invitations.tokenDigest, digest));
      if (!found) return null;
      const [game] = await tx
        .select({ gmAccountId: games.gmAccountId })
        .from(games)
        .where(eq(games.id, found.gameId))
        .for("update");
      const [link] = await tx
        .select({ kind: invitations.kind, characterId: invitations.characterId })
        .from(invitations)
        .where(
          and(
            eq(invitations.gameId, found.gameId),
            eq(invitations.tokenDigest, digest),
            eq(invitations.enabled, true),
          ),
        );
      return game && link ? { ...link, gameId: found.gameId, gmAccountId: game.gmAccountId } : null;
    },
    async invalidateCharacters(gameId, ids) {
      if (ids.length)
        await tx
          .delete(invitations)
          .where(
            and(
              eq(invitations.gameId, gameId),
              eq(invitations.kind, "character"),
              inArray(invitations.characterId, ids),
            ),
          );
    },
  };
}
