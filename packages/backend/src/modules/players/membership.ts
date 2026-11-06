import type { Pool, PoolClient } from "pg";
import type { Actor } from "../auth/guards.ts";
import { lockGame } from "../games/service.ts";
import { closeMemberStreams, publishGameEvent } from "../events/streams.ts";

type MemberRow = { id: string; account_id: string; name: string; removed: boolean; active_character_id: string | null; revision: number };
const presentMember = (row: MemberRow) => ({ id: row.id, accountId: row.account_id, name: row.name, removed: row.removed, activeCharacterId: row.active_character_id, revision: row.revision });
const failure = (code: string) => Object.assign(new Error(code), { code });

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listMembers(pool: Pool, actor: Actor, gameId: string) {
  const result = await pool.query<MemberRow>(
    `SELECT p.id,p.account_id,p.name,p.removed,p.active_character_id,p.revision
     FROM players p JOIN games g ON g.id=p.game_id
     WHERE p.game_id=$1 AND (g.gm_account_id=$2 OR (NOT p.removed AND EXISTS
       (SELECT 1 FROM players viewer WHERE viewer.game_id=g.id AND viewer.account_id=$2 AND NOT viewer.removed)))
     ORDER BY p.name,p.id`, [gameId, actor.accountId],
  );
  return result.rows.map(presentMember);
}

export async function setMemberRemoved(pool: Pool, actor: Actor, gameId: string, membershipId: string, removed: boolean) {
  const result = await transaction(pool, async (client) => {
    const access = await lockGame(client, actor, gameId);
    if (access.role !== "GM") throw failure("forbidden");
    const selected = await client.query<MemberRow>("SELECT id,account_id,name,removed,active_character_id,revision FROM players WHERE id=$1 AND game_id=$2", [membershipId, gameId]);
    const member = selected.rows[0];
    if (!member) throw failure("not_found");
    if (member.removed === removed) return { member: presentMember(member), changed: false };
    if (removed) {
      await client.query("DELETE FROM invitations WHERE character_id IN (SELECT id FROM characters WHERE game_id=$1 AND player_id=$2)", [gameId, membershipId]);
      await client.query("UPDATE players SET active_character_id=NULL, revision=revision + CASE WHEN active_character_id IS NULL THEN 0 ELSE 1 END WHERE id=$1", [membershipId]);
      await client.query("UPDATE characters SET player_id=NULL,gm_active=false WHERE game_id=$1 AND player_id=$2", [gameId, membershipId]);
    }
    const updated = await client.query<MemberRow>("UPDATE players SET removed=$2 WHERE id=$1 RETURNING id,account_id,name,removed,active_character_id,revision", [membershipId, removed]);
    return { member: presentMember(updated.rows[0]!), changed: true };
  });
  if (result.changed) {
    if (removed) closeMemberStreams(gameId, result.member.accountId);
    publishGameEvent(gameId, { type: "roster" });
  }
  return result.member;
}

export async function selectPlayerCharacter(pool: Pool, actor: Actor, gameId: string, expectedRevision: number, characterId: string | null, targetMembershipId?: string) {
  const result = await transaction(pool, async (client) => {
    const access = await lockGame(client, actor, gameId);
    if (targetMembershipId && access.role !== "GM") throw failure("forbidden");
    if (!targetMembershipId && access.role !== "Player") throw failure("forbidden");
    const membershipId = targetMembershipId ?? (access.role === "Player" ? access.membershipId : null);
    const members = await client.query<MemberRow>("SELECT id,account_id,name,removed,active_character_id,revision FROM players WHERE id=$1 AND game_id=$2 AND NOT removed", [membershipId, gameId]);
    const member = members.rows[0];
    if (!member) throw failure("not_found");
    if (member.revision !== expectedRevision) throw failure("stale_revision");
    if (characterId !== null) {
      const character = await client.query("SELECT id FROM characters WHERE id=$1 AND game_id=$2 AND player_id=$3", [characterId, gameId, membershipId]);
      if (!character.rowCount) throw failure("not_found");
    }
    if (member.active_character_id === characterId) return { member: presentMember(member), changed: false };
    const updated = await client.query<MemberRow>("UPDATE players SET active_character_id=$2,revision=revision+1 WHERE id=$1 RETURNING id,account_id,name,removed,active_character_id,revision", [membershipId, characterId]);
    return { member: presentMember(updated.rows[0]!), changed: true };
  });
  if (result.changed) publishGameEvent(gameId, { type: "roster" });
  return result.member;
}
