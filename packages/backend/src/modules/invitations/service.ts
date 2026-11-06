import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Actor } from "../auth/guards.ts";
import { lockGame } from "../games/service.ts";
import { publishGameEvent } from "../events/streams.ts";

type InvitationRow = { id: string; game_id: string; kind: "game" | "character"; character_id: string | null; token_encrypted: Buffer; enabled: boolean };
const failure = (code: string) => Object.assign(new Error(code), { code });
const digest = (token: string) => createHash("sha256").update(token).digest();

function encryptionKey() {
  const secret = process.env.INVITATION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("INVITATION_SECRET must contain at least 32 bytes");
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
  return { id: row.id, kind: row.kind, characterId: row.character_id, enabled: row.enabled, url: `${origin}/invite/${decrypt(row.token_encrypted)}` };
}

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await operation(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requireGm(client: PoolClient, actor: Actor, gameId: string) {
  const access = await lockGame(client, actor, gameId);
  if (access.role !== "GM") throw failure("forbidden");
}

export async function listInvitations(pool: Pool, actor: Actor, gameId: string) {
  const result = await pool.query<InvitationRow>(
    `SELECT i.id,i.game_id,i.kind,i.character_id,i.token_encrypted,i.enabled FROM invitations i
     JOIN games g ON g.id=i.game_id WHERE i.game_id=$1 AND g.gm_account_id=$2 ORDER BY i.created_at,i.id`, [gameId, actor.accountId],
  );
  return result.rows.map(present);
}

export async function ensureGameInvitation(pool: Pool, actor: Actor, gameId: string) {
  return transaction(pool, async (client) => {
    await requireGm(client, actor, gameId);
    const existing = await client.query<InvitationRow>("SELECT id,game_id,kind,character_id,token_encrypted,enabled FROM invitations WHERE game_id=$1 AND kind='game'", [gameId]);
    if (existing.rows[0]) return present(existing.rows[0]);
    const token = randomBytes(32).toString("base64url");
    const result = await client.query<InvitationRow>(
      "INSERT INTO invitations (id,game_id,kind,token_digest,token_encrypted) VALUES ($1,$2,'game',$3,$4) RETURNING id,game_id,kind,character_id,token_encrypted,enabled",
      [randomUUID(), gameId, digest(token), encrypt(token)],
    );
    return present(result.rows[0]!);
  });
}

export async function createCharacterInvitation(pool: Pool, actor: Actor, gameId: string, characterId: string) {
  return transaction(pool, async (client) => {
    await requireGm(client, actor, gameId);
    const character = await client.query("SELECT id FROM characters WHERE game_id=$1 AND id=$2 AND player_id IS NULL", [gameId, characterId]);
    if (!character.rowCount) throw failure("not_found");
    const token = randomBytes(32).toString("base64url");
    const result = await client.query<InvitationRow>(
      "INSERT INTO invitations (id,game_id,kind,character_id,token_digest,token_encrypted) VALUES ($1,$2,'character',$3,$4,$5) RETURNING id,game_id,kind,character_id,token_encrypted,enabled",
      [randomUUID(), gameId, characterId, digest(token), encrypt(token)],
    );
    return present(result.rows[0]!);
  });
}

export async function updateInvitation(pool: Pool, actor: Actor, gameId: string, invitationId: string, change: { enabled: boolean } | { rotate: true }) {
  return transaction(pool, async (client) => {
    await requireGm(client, actor, gameId);
    const token = "rotate" in change ? randomBytes(32).toString("base64url") : null;
    const result = token
      ? await client.query<InvitationRow>("UPDATE invitations SET token_digest=$3,token_encrypted=$4 WHERE id=$1 AND game_id=$2 RETURNING id,game_id,kind,character_id,token_encrypted,enabled", [invitationId, gameId, digest(token), encrypt(token)])
      : await client.query<InvitationRow>("UPDATE invitations SET enabled=$3 WHERE id=$1 AND game_id=$2 RETURNING id,game_id,kind,character_id,token_encrypted,enabled", [invitationId, gameId, (change as {enabled: boolean}).enabled]);
    if (!result.rows[0]) throw failure("not_found");
    return present(result.rows[0]);
  });
}

type PreviewRow = { kind: "game" | "character"; game_id: string; game_name: string; gm_account_id: string; member_id: string | null; removed: boolean | null; character_id: string | null; character_name: string | null };
export async function previewInvitation(pool: Pool, actor: Actor, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw failure("not_found");
  const result = await pool.query<PreviewRow>(
    `SELECT i.kind,g.id AS game_id,g.name AS game_name,g.gm_account_id,p.id AS member_id,p.removed,c.id AS character_id,c.name AS character_name
     FROM invitations i JOIN games g ON g.id=i.game_id LEFT JOIN players p ON p.game_id=g.id AND p.account_id=$2
     LEFT JOIN characters c ON c.id=i.character_id AND c.game_id=g.id AND c.player_id IS NULL
     WHERE i.token_digest=$1 AND i.enabled AND (i.kind='game' OR c.id IS NOT NULL)`, [digest(token), actor.accountId],
  );
  const row = result.rows[0];
  if (!row || row.removed) throw failure("not_found");
  const common = { gameId: row.game_id, gameName: row.game_name, alreadyMember: row.gm_account_id === actor.accountId || !!row.member_id };
  return row.kind === "game"
    ? { kind: "game" as const, ...common }
    : { kind: "character" as const, ...common, characterId: row.character_id!, characterName: row.character_name! };
}

export async function acceptInvitation(pool: Pool, actor: Actor, token: string, makeActive = true) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw failure("not_found");
  const outcome = await transaction(pool, async (client) => {
    const found = await client.query<{game_id: string}>("SELECT game_id FROM invitations WHERE token_digest=$1", [digest(token)]);
    if (!found.rows[0]) throw failure("not_found");
    const gameId = found.rows[0].game_id;
    const game = await client.query<{gm_account_id: string}>("SELECT gm_account_id FROM games WHERE id=$1 FOR UPDATE", [gameId]);
    const invitation = await client.query<{kind: "game" | "character"; character_id: string | null}>("SELECT kind,character_id FROM invitations WHERE game_id=$1 AND token_digest=$2 AND enabled", [gameId, digest(token)]);
    if (!game.rows[0] || !invitation.rowCount) throw failure("not_found");
    const link = invitation.rows[0]!;
    if (game.rows[0].gm_account_id === actor.accountId) {
      if (link.kind === "character") throw failure("forbidden");
      return { gameId, changed: false };
    }
    const membership = await client.query<{id: string; removed: boolean}>("SELECT id,removed FROM players WHERE game_id=$1 AND account_id=$2", [gameId, actor.accountId]);
    if (membership.rows[0]?.removed) throw failure("not_found");
    if (link.kind === "character") {
      const target = await client.query("SELECT id FROM characters WHERE game_id=$1 AND id=$2 AND player_id IS NULL", [gameId, link.character_id]);
      if (!target.rowCount) throw failure("not_found");
    }
    let membershipId = membership.rows[0]?.id;
    if (!membershipId) {
      membershipId = randomUUID();
      await client.query("INSERT INTO players (id,game_id,account_id,name) SELECT $1,$2,id,left(username,20) FROM accounts WHERE id=$3", [membershipId, gameId, actor.accountId]);
    }
    if (link.kind === "game") return { gameId, changed: !membership.rows[0] };
    await client.query("UPDATE characters SET player_id=$3,gm_active=false WHERE game_id=$1 AND id=$2", [gameId, link.character_id, membershipId]);
    if (makeActive) await client.query("UPDATE players SET active_character_id=$2,revision=revision+1 WHERE id=$1 AND active_character_id IS DISTINCT FROM $2", [membershipId, link.character_id]);
    await client.query("DELETE FROM invitations WHERE game_id=$1 AND character_id=$2 AND kind='character'", [gameId, link.character_id]);
    return { gameId, changed: true, characterId: link.character_id!, active: makeActive };
  });
  if (outcome.changed) publishGameEvent(outcome.gameId, { type: "roster" });
  if (outcome.characterId) return { gameId: outcome.gameId, characterId: outcome.characterId, active: outcome.active! };
  return { gameId: outcome.gameId };
}
