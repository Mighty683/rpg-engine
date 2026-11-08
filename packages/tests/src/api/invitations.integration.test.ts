import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API invitations", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("invitations");
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("invalidates old and disabled invitation tokens without granting membership", async () => {
    const { ids, request, pool } = fixture;
    const created = await request(`/games/${ids.game}/invitations`, "gm", "POST", { kind: "game" });
    const invitation = (await created.json()).invitation;
    const oldToken = invitation.url.split("/").at(-1);
    expect(
      (await request(`/games/${ids.game}/invitations/${invitation.id}/rotate`, "player", "POST"))
        .status,
    ).toBe(403);
    const rotated = await request(
      `/games/${ids.game}/invitations/${invitation.id}/rotate`,
      "gm",
      "POST",
    );
    expect(rotated.status).toBe(200);
    const newToken = (await rotated.json()).invitation.url.split("/").at(-1);
    expect(newToken).not.toBe(oldToken);
    expect((await request(`/invitations/${oldToken}/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
    expect(
      (
        await request(`/games/${ids.game}/invitations/${invitation.id}`, "gm", "PATCH", {
          enabled: false,
        })
      ).status,
    ).toBe(200);
    expect((await request(`/invitations/${newToken}/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
    expect((await request(`/invitations/not-a-token/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
    expect((await request(`/games/${ids.game}`, "outsider")).status).toBe(404);
    expect(
      (
        await pool.query(
          "SELECT id FROM players WHERE game_id=$1 AND account_id=(SELECT gm_account_id FROM games WHERE id=$2)",
          [ids.game, ids.otherGame],
        )
      ).rowCount,
    ).toBe(0);
  });

  it("creates membership and assigns a character when an outsider accepts a character invitation", async () => {
    const { ids, request, pool } = fixture;
    const created = await request(`/games/${ids.game}/invitations`, "gm", "POST", {
      kind: "character",
      characterId: ids.gmCharacter,
    });
    expect(created.status).toBe(200);
    const token = (await created.json()).invitation.url.split("/").at(-1);
    const preview = await request(`/invitations/${token}`, "outsider");
    expect(preview.status).toBe(200);
    expect((await preview.json()).invitation).toMatchObject({
      kind: "character",
      characterId: ids.gmCharacter,
      alreadyMember: false,
    });
    const accepted = await request(`/invitations/${token}/accept`, "outsider", "POST", {
      makeActive: true,
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      gameId: ids.game,
      characterId: ids.gmCharacter,
      active: true,
    });
    const saved = await pool.query(
      "SELECT p.id, p.active_character_id, c.player_id FROM players p JOIN characters c ON c.player_id=p.id WHERE p.game_id=$1 AND p.account_id=$2 AND c.id=$3",
      [ids.game, ids.outsider, ids.gmCharacter],
    );
    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0]).toMatchObject({
      active_character_id: ids.gmCharacter,
      player_id: saved.rows[0].id,
    });
    expect((await request(`/invitations/${token}/accept`, "outsider", "POST", {})).status).toBe(
      404,
    );
  });
});
