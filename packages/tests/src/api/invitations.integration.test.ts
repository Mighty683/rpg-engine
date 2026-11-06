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
});
