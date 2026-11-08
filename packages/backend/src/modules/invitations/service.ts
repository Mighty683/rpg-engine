import { notifyAfterCommit, transaction } from "../../database/transaction.ts";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database, DatabaseTransaction } from "../../database/client.ts";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { accounts, characters, games, invitations, players } from "../../database/schema.ts";
import type { Actor } from "../auth/guards.ts";
import { lockGame } from "../games/service.ts";
import { publishGameEvent } from "../events/streams.ts";

type InvitationRow = typeof invitations.$inferSelect;
const failure = (code: string) => Object.assign(new Error(code), { code });
const digest = (token: string) => createHash("sha256").update(token).digest();

function encryptionKey() {
  const secret = process.env.INVITATION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("INVITATION_SECRET must contain at least 32 bytes");
  return createHash("sha256").update(secret).digest();
}

function encrypt(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(data: Buffer) {
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8");
}

function present(row: InvitationRow) {
  const origin = process.env.APP_ORIGIN ?? (process.env.NODE_ENV === "production" ? undefined : "");
  if (origin === undefined) throw new Error("APP_ORIGIN is required");
  return {
    id: row.id,
    kind: row.kind,
    characterId: row.characterId,
    enabled: row.enabled,
    url: `${origin}/invite/${decrypt(row.tokenEncrypted)}`,
  };
}

async function requireGm(tx: DatabaseTransaction, actor: Actor, gameId: string) {
  const access = await lockGame(tx, actor, gameId);
  if (access.role !== "GM") throw failure("forbidden");
}

export async function listInvitations(database: Database, actor: Actor, gameId: string) {
  const result = await database
    .select({ invitation: invitations })
    .from(invitations)
    .innerJoin(games, eq(games.id, invitations.gameId))
    .where(and(eq(invitations.gameId, gameId), eq(games.gmAccountId, actor.accountId)))
    .orderBy(invitations.createdAt, invitations.id);
  return result.map((row) => present(row.invitation));
}

export async function ensureGameInvitation(database: Database, actor: Actor, gameId: string) {
  return transaction(database, async (tx) => {
    await requireGm(tx, actor, gameId);
    const db = tx;
    const [existing] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.gameId, gameId), eq(invitations.kind, "game")));
    if (existing) return present(existing);
    const token = randomBytes(32).toString("base64url");
    const [created] = await db
      .insert(invitations)
      .values({
        id: randomUUID(),
        gameId,
        kind: "game",
        tokenDigest: digest(token),
        tokenEncrypted: encrypt(token),
      })
      .returning();
    return present(created!);
  });
}

export async function createCharacterInvitation(
  database: Database,
  actor: Actor,
  gameId: string,
  characterId: string,
) {
  return transaction(database, async (tx) => {
    await requireGm(tx, actor, gameId);
    const db = tx;
    const [character] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(
        and(
          eq(characters.gameId, gameId),
          eq(characters.id, characterId),
          isNull(characters.playerId),
        ),
      );
    if (!character) throw failure("not_found");
    const token = randomBytes(32).toString("base64url");
    const [created] = await db
      .insert(invitations)
      .values({
        id: randomUUID(),
        gameId,
        kind: "character",
        characterId,
        tokenDigest: digest(token),
        tokenEncrypted: encrypt(token),
      })
      .returning();
    return present(created!);
  });
}

export async function updateInvitation(
  database: Database,
  actor: Actor,
  gameId: string,
  invitationId: string,
  change: { enabled: boolean } | { rotate: true },
) {
  return transaction(database, async (tx) => {
    await requireGm(tx, actor, gameId);
    const token = "rotate" in change ? randomBytes(32).toString("base64url") : null;
    const updates = token
      ? { tokenDigest: digest(token), tokenEncrypted: encrypt(token) }
      : { enabled: (change as { enabled: boolean }).enabled };
    const [updated] = await tx
      .update(invitations)
      .set(updates)
      .where(and(eq(invitations.id, invitationId), eq(invitations.gameId, gameId)))
      .returning();
    if (!updated) throw failure("not_found");
    return present(updated);
  });
}

export async function previewInvitation(database: Database, actor: Actor, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw failure("not_found");
  const [row] = await database
    .select({
      kind: invitations.kind,
      gameId: games.id,
      gameName: games.name,
      gmAccountId: games.gmAccountId,
      memberId: players.id,
      removed: players.removed,
      characterId: characters.id,
      characterName: characters.name,
    })
    .from(invitations)
    .innerJoin(games, eq(games.id, invitations.gameId))
    .leftJoin(players, and(eq(players.gameId, games.id), eq(players.accountId, actor.accountId)))
    .leftJoin(
      characters,
      and(
        eq(characters.id, invitations.characterId),
        eq(characters.gameId, games.id),
        isNull(characters.playerId),
      ),
    )
    .where(
      and(
        eq(invitations.tokenDigest, digest(token)),
        eq(invitations.enabled, true),
        or(eq(invitations.kind, "game"), isNotNull(characters.id)),
      ),
    );
  if (!row || row.removed) throw failure("not_found");
  const common = {
    gameId: row.gameId,
    gameName: row.gameName,
    alreadyMember: row.gmAccountId === actor.accountId || !!row.memberId,
  };
  return row.kind === "game"
    ? { kind: "game" as const, ...common }
    : {
        kind: "character" as const,
        ...common,
        characterId: row.characterId!,
        characterName: row.characterName!,
      };
}

export async function acceptInvitation(
  database: Database,
  actor: Actor,
  token: string,
  makeActive = true,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw failure("not_found");
  const outcome = await transaction(database, async (tx) => {
    const db = tx;
    const [found] = await db
      .select({ gameId: invitations.gameId })
      .from(invitations)
      .where(eq(invitations.tokenDigest, digest(token)));
    if (!found) throw failure("not_found");
    const gameId = found.gameId;
    const [game] = await db
      .select({ gmAccountId: games.gmAccountId })
      .from(games)
      .where(eq(games.id, gameId))
      .for("update");
    const [link] = await db
      .select({ kind: invitations.kind, characterId: invitations.characterId })
      .from(invitations)
      .where(
        and(
          eq(invitations.gameId, gameId),
          eq(invitations.tokenDigest, digest(token)),
          eq(invitations.enabled, true),
        ),
      );
    if (!game || !link) throw failure("not_found");
    if (game.gmAccountId === actor.accountId) {
      if (link.kind === "character") throw failure("forbidden");
      return { gameId, changed: false };
    }
    const [membership] = await db
      .select({ id: players.id, removed: players.removed })
      .from(players)
      .where(and(eq(players.gameId, gameId), eq(players.accountId, actor.accountId)));
    if (membership?.removed) throw failure("not_found");
    if (link.kind === "character") {
      if (!link.characterId) throw failure("not_found");
      const [target] = await db
        .select({ id: characters.id })
        .from(characters)
        .where(
          and(
            eq(characters.gameId, gameId),
            eq(characters.id, link.characterId),
            isNull(characters.playerId),
          ),
        );
      if (!target) throw failure("not_found");
    }
    let membershipId = membership?.id;
    if (!membershipId) {
      membershipId = randomUUID();
      const [account] = await db
        .select({ name: sql<string>`left(${accounts.username},20)` })
        .from(accounts)
        .where(eq(accounts.id, actor.accountId));
      if (!account) throw failure("not_found");
      await db
        .insert(players)
        .values({ id: membershipId, gameId, accountId: actor.accountId, name: account.name });
    }
    if (link.kind === "game") return { gameId, changed: !membership };
    if (!link.characterId) throw failure("not_found");
    await db
      .update(characters)
      .set({ playerId: membershipId, gmActive: false })
      .where(and(eq(characters.gameId, gameId), eq(characters.id, link.characterId)));
    if (makeActive)
      await db
        .update(players)
        .set({ activeCharacterId: link.characterId, revision: sql`${players.revision}+1` })
        .where(
          and(
            eq(players.id, membershipId),
            sql`${players.activeCharacterId} IS DISTINCT FROM ${link.characterId}`,
          ),
        );
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.gameId, gameId),
          eq(invitations.characterId, link.characterId),
          eq(invitations.kind, "character"),
        ),
      );
    return { gameId, changed: true, characterId: link.characterId, active: makeActive };
  });
  if (outcome.changed)
    await notifyAfterCommit(() => publishGameEvent(outcome.gameId, { type: "roster" }));
  if (outcome.characterId)
    return { gameId: outcome.gameId, characterId: outcome.characterId, active: outcome.active! };
  return { gameId: outcome.gameId };
}
