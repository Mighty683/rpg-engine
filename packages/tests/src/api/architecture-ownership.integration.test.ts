import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { createOwnershipWorkflows } from "../../../backend/src/application/ownership.ts";
import { createCharacterOwnership } from "../../../backend/src/modules/characters/ownership.ts";
import { createMembershipOwnership } from "../../../backend/src/modules/players/ownership.ts";
import { createInvitationOwnership } from "../../../backend/src/modules/invitations/ownership.ts";
import { createGameAccessService } from "../../../backend/src/modules/games/service.ts";
import { createGameEvents } from "../../../backend/src/modules/events/streams.ts";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

describe("Atomic cross-module ownership workflows", () => {
  let fixture: ApiFixture;
  beforeEach(async () => {
    fixture = await createApiFixture("architecture_ownership");
  });
  afterEach(async () => {
    await fixture?.cleanup();
  });

  async function invite(characterId: string) {
    const response = await fixture.request(`/games/${fixture.ids.game}/invitations`, "gm", "POST", {
      kind: "character",
      characterId,
    });
    expect(response.status).toBe(200);
    return (await response.json()).invitation.url.split("/").at(-1) as string;
  }

  async function state() {
    const { pool } = fixture;
    return {
      characters: (
        await pool.query("SELECT id, game_id, player_id, gm_active FROM characters ORDER BY id")
      ).rows,
      members: (
        await pool.query(
          "SELECT id, game_id, account_id, removed, active_character_id, revision FROM players ORDER BY id",
        )
      ).rows,
      invitations: (
        await pool.query("SELECT id, game_id, character_id, enabled FROM invitations ORDER BY id")
      ).rows,
    };
  }

  it("rejects unauthorized transfers, clears former selection, invalidates links, and removes members atomically", async () => {
    const { ids, request, pool } = fixture;
    await invite(ids.gmCharacter);
    const before = await state();
    const path = `/games/${ids.game}/characters/${ids.playerCharacter}/controller`;
    expect((await request(path, "player", "PATCH", { membershipId: null })).status).toBe(403);
    expect((await request(path, "gm", "PATCH", { membershipId: ids.otherMember })).status).toBe(
      404,
    );
    expect(
      (await request(`/games/${ids.game}/members/${ids.otherMember}/remove`, "gm", "POST")).status,
    ).toBe(404);
    expect(await state()).toEqual(before);

    expect((await request(path, "gm", "PATCH", { membershipId: null })).status).toBe(200);
    const former = (
      await pool.query("SELECT active_character_id, revision FROM players WHERE id=$1", [
        ids.member,
      ])
    ).rows[0];
    expect(former).toMatchObject({ active_character_id: null, revision: 2 });
    const token = await invite(ids.playerCharacter);
    expect((await request(path, "gm", "PATCH", { membershipId: ids.member })).status).toBe(200);
    expect((await request(`/invitations/${token}/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
    expect(
      (
        await request(`/games/${ids.game}/active-character`, "player", "PUT", {
          expectedRevision: 2,
          characterId: ids.playerCharacter,
        })
      ).status,
    ).toBe(200);
    // Seed a legacy outstanding link to the owned character to exercise removal invalidation.
    await pool.query("UPDATE invitations SET character_id=$1 WHERE character_id=$2", [
      ids.playerCharacter,
      ids.gmCharacter,
    ]);
    const unrelated = before.members.find((row) => row.id === ids.otherMember);
    expect(
      (await request(`/games/${ids.game}/members/${ids.member}/remove`, "gm", "POST")).status,
    ).toBe(200);
    const after = await state();
    expect(after.members.find((row) => row.id === ids.member)).toMatchObject({
      removed: true,
      active_character_id: null,
      revision: 4,
    });
    expect(after.characters.find((row) => row.id === ids.playerCharacter)).toMatchObject({
      player_id: null,
      gm_active: false,
    });
    expect(after.invitations).toEqual([]);
    expect(after.members.find((row) => row.id === ids.otherMember)).toEqual(unrelated);
    expect(after.characters.find((row) => row.id === ids.foreignCharacter)).toEqual(
      before.characters.find((row) => row.id === ids.foreignCharacter),
    );
    expect((await request(`/games/${ids.game}/characters`, "player")).status).toBe(404);
    expect(
      (
        await request(`/games/${ids.game}/characters`, "player", "POST", {
          id: randomUUID(),
          name: "Rejected",
        })
      ).status,
    ).toBe(404);
    expect(await state()).toEqual(after);
  });

  it("serializes concurrent acceptance into one owner and one active selection", async () => {
    const { ids, request, pool } = fixture;
    const token = await invite(ids.gmCharacter);
    const responses = await Promise.all(
      ["player", "outsider"].map((actor) =>
        request(`/invitations/${token}/accept`, actor, "POST", { makeActive: true }),
      ),
    );
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 404]);
    const [owner] = (
      await pool.query(
        "SELECT p.id, p.account_id, p.active_character_id FROM characters c JOIN players p ON p.id=c.player_id WHERE c.id=$1",
        [ids.gmCharacter],
      )
    ).rows;
    expect(owner.active_character_id).toBe(ids.gmCharacter);
    expect([ids.player, ids.outsider]).toContain(owner.account_id);
    expect(
      (
        await pool.query(
          "SELECT account_id FROM players WHERE game_id=$1 GROUP BY account_id HAVING count(*) > 1",
          [ids.game],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await pool.query("SELECT id FROM invitations WHERE character_id=$1", [ids.gmCharacter]))
        .rows,
    ).toEqual([]);
    const saved = await state();
    expect((await request(`/invitations/${token}/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
    expect(await state()).toEqual(saved);
  });

  it("rolls back invitation, selection and character mutations when a later owner operation fails, without notification", async () => {
    const { ids, pool } = fixture;
    await invite(ids.gmCharacter);
    await pool.query("UPDATE invitations SET character_id=$1 WHERE character_id=$2", [
      ids.playerCharacter,
      ids.gmCharacter,
    ]);
    const before = await state();
    const events = createGameEvents();
    const publish = vi.spyOn(events, "publishGameEvent");
    const revoke = vi.spyOn(events, "closeMemberStreams");
    const workflows = createOwnershipWorkflows({
      database: databaseFromPool(pool),
      events,
      gameAccessFor: createGameAccessService,
      storesFor: (tx) => ({
        characters: createCharacterOwnership(tx),
        invitations: createInvitationOwnership(tx),
        memberships: {
          ...createMembershipOwnership(tx),
          setRemoved: async () => {
            throw new Error("Injected owner failure");
          },
        },
      }),
    });
    await expect(
      workflows.setMemberRemoved(
        { accountId: ids.gm, sessionId: randomUUID() },
        ids.game,
        ids.member,
        true,
      ),
    ).rejects.toThrow("Injected owner failure");
    expect(await state()).toEqual(before);
    expect(publish).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    events.dispose();
  });
});
