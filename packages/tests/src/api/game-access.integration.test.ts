import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API game access and membership", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("game_access");
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("rejects anonymous, invalid-session, and non-member access across game resources", async () => {
    const { ids, request } = fixture;
    for (const actor of [null, "invalid-session"]) {
      expect((await request(`/games/${ids.game}`, actor)).status).toBe(401);
      expect(
        (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, actor)).status,
      ).toBe(401);
      expect(
        (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, actor, "DELETE")).status,
      ).toBe(401);
    }
    const before = await readPersistedState(fixture);
    for (const path of [
      `/games/${ids.game}`,
      `/games/${ids.game}/characters`,
      `/games/${ids.game}/characters/${ids.gmCharacter}`,
      `/games/${ids.game}/members`,
      `/games/${ids.game}/invitations`,
      `/games/${ids.game}/events`,
    ]) {
      expect((await request(path, "outsider")).status, path).toBe(404);
    }
    expect(
      (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "outsider", "DELETE"))
        .status,
    ).toBe(404);
    expect(await readPersistedState(fixture)).toEqual(before);
  });

  it("rejects player privilege escalation and cross-game membership or invitation identifiers", async () => {
    const { ids, request, pool } = fixture;
    const before = await readPersistedState(fixture);
    const attempts: [string, string, string, unknown?][] = [
      ["player", "POST", `/games/${ids.game}/members/${ids.member}/remove`],
      ["player", "POST", `/games/${ids.game}/members/${ids.member}/restore`],
      [
        "player",
        "PUT",
        `/games/${ids.game}/members/${ids.member}/active-character`,
        { characterId: null, expectedRevision: 1 },
      ],
      ["player", "GET", `/games/${ids.game}/invitations`],
      ["player", "POST", `/games/${ids.game}/invitations`, { kind: "game" }],
      ["gm", "POST", `/games/${ids.game}/members/${ids.otherMember}/remove`],
      [
        "gm",
        "POST",
        `/games/${ids.game}/invitations`,
        { kind: "character", characterId: ids.foreignCharacter },
      ],
    ];
    for (const [actor, method, path, body] of attempts)
      expect((await request(path, actor, method, body)).status, path).toBe(
        actor === "player" ? 403 : 404,
      );
    expect(await readPersistedState(fixture)).toEqual(before);
    expect(
      (await pool.query("SELECT id FROM invitations WHERE game_id=$1", [ids.game])).rowCount,
    ).toBe(0);
  });

  it("revokes access immediately and prevents removed members from rejoining with an invitation", async () => {
    const { ids, request } = fixture;
    const created = await request(`/games/${ids.game}/invitations`, "gm", "POST", { kind: "game" });
    expect(created.status).toBe(200);
    const token = (await created.json()).invitation.url.split("/").at(-1);
    expect(
      (await request(`/games/${ids.game}/members/${ids.member}/remove`, "gm", "POST")).status,
    ).toBe(200);
    const before = await readPersistedState(fixture);
    for (const path of [
      `/games/${ids.game}`,
      `/games/${ids.game}/characters/${ids.playerCharacter}`,
      `/games/${ids.game}/events`,
      `/invitations/${token}`,
    ]) {
      expect((await request(path, "player")).status, path).toBe(404);
    }
    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player", "DELETE"))
        .status,
    ).toBe(404);
    expect((await request(`/invitations/${token}/accept`, "player", "POST", {})).status).toBe(404);
    expect(await readPersistedState(fixture)).toEqual(before);
    expect(
      (await request(`/games/${ids.game}/members/${ids.member}/restore`, "gm", "POST")).status,
    ).toBe(200);
    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player")).status,
    ).toBe(200);
    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player", "DELETE"))
        .status,
    ).toBe(403);
  });
});
