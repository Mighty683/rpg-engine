import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

/** API-VAL-01–04: boundary schemas preserve endpoint policy and never replace transaction checks. */
describe("request schema compatibility", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("request_validation", {
      appOrigin: "https://validation.example",
    });
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  async function persisted() {
    const result = await fixture.pool.query(`SELECT
      (SELECT count(*) FROM accounts)::int AS accounts,
      (SELECT count(*) FROM sessions)::int AS sessions,
      (SELECT count(*) FROM games)::int AS games,
      (SELECT count(*) FROM npcs)::int AS npcs,
      (SELECT count(*) FROM throws)::int AS throws,
      (SELECT count(*) FROM invitations)::int AS invitations`);
    return { counts: result.rows[0], state: await readPersistedState(fixture) };
  }

  it("API-VAL-01 rejects malformed envelopes and forged fields without writes", async () => {
    const game = `/games/${fixture.ids.game}`;
    const before = await persisted();
    const cases: [string, string, unknown, number, string][] = [
      ["/games", "POST", [], 400, "bad_request"],
      ["/games", "POST", { name: "", systemId: "unknown" }, 422, "validation"],
      [`${game}/characters`, "POST", { id: "bad", name: "Hero" }, 400, "bad_request"],
      [
        `${game}/characters/${fixture.ids.gmCharacter}`,
        "PATCH",
        { expectedRevision: "0", changes: {} },
        400,
        "bad_request",
      ],
      [
        `${game}/npcs`,
        "POST",
        { id: randomUUID(), npc: {}, gmAccountId: fixture.ids.outsider },
        400,
        "bad_request",
      ],
      [
        `${game}/npcs`,
        "POST",
        { id: randomUUID(), npc: { name: "Incomplete" } },
        422,
        "validation",
      ],
      [
        `${game}/invitations`,
        "POST",
        { kind: "character", characterId: "bad" },
        400,
        "bad_request",
      ],
      [
        `${game}/members/${fixture.ids.member}/active-character`,
        "PUT",
        { expectedRevision: "0", characterId: null },
        400,
        "bad_request",
      ],
      [
        `${game}/throws`,
        "POST",
        { setup: {}, authorAccountId: fixture.ids.outsider },
        422,
        "validation",
      ],
    ];
    for (const [path, method, body, status, code] of cases) {
      const response = await fixture.request(path, "gm", method, body);
      expect(response.status, path).toBe(status);
      expect(await response.json()).toMatchObject({ error: { code } });
    }
    expect((await fixture.request(`${game}/characters`, null, "POST", {})).status).toBe(401);
    expect((await fixture.request(`${game}/characters`, "outsider", "POST", {})).status).toBe(404);
    expect(await persisted()).toEqual(before);
  });

  it("API-VAL-02 retains login, registration, origin and CSRF behavior", async () => {
    const before = await persisted();
    const login = await fixture.request("/auth/login", null, "POST", {
      username: 42,
      password: {},
    });
    expect(login.status).toBe(401);
    expect(await login.json()).toMatchObject({ error: { code: "invalid_credentials" } });
    const invalid = await fixture.request("/auth/register", null, "POST", {
      username: "!",
      password: "short",
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({
      error: {
        code: "validation",
        fields: {
          username: "Use 3–32 letters, numbers, dots, underscores, or hyphens.",
          password: "Use at least 8 characters and at most 1024 bytes.",
        },
      },
    });
    const oversized = await fixture.request("/auth/register", null, "POST", {
      username: "ValidName",
      password: "😀".repeat(257),
    });
    expect(oversized.status).toBe(422);
    expect(
      (await fixture.request("/auth/register", null, "POST", {}, "https://wrong.example")).status,
    ).toBe(403);
    const noCsrf = await fetch(`${fixture.origin}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://validation.example" },
      body: "{}",
    });
    expect(noCsrf.status).toBe(403);
    expect(await persisted()).toEqual(before);
    const username = `v_${randomUUID().replaceAll("-", "").slice(0, 15)}`;
    const registration = { username: ` ${username} `, password: "😀".repeat(4), ignored: true };
    const created = await fixture.request("/auth/register", null, "POST", registration);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ account: { username } });
    const afterCreated = await persisted();
    expect((await fixture.request("/auth/register", null, "POST", registration)).status).toBe(409);
    expect(await persisted()).toEqual(afterCreated);
  });

  it("API-VAL-03 accepts normalized permissive requests and partial sheet patches", async () => {
    const createdGame = await fixture.request("/games", "gm", "POST", {
      name: " 😀 schema ",
      systemId: "fabula-ultima",
      gmAccountId: fixture.ids.outsider,
    });
    expect(createdGame.status).toBe(201);
    const { game } = await createdGame.json();
    const savedGame = await fixture.pool.query("SELECT name,gm_account_id FROM games WHERE id=$1", [
      game.id,
    ]);
    expect(savedGame.rows).toEqual([{ name: "😀 schema", gm_account_id: fixture.ids.gm }]);
    const id = randomUUID();
    const path = `/games/${fixture.ids.game}/characters/${id}`;
    const character = await fixture.request(`/games/${fixture.ids.game}/characters`, "gm", "POST", {
      id,
      name: " Unicode 😀 ",
      playerId: fixture.ids.member,
    });
    expect(character.status).toBe(201);
    expect((await character.json()).character).toMatchObject({
      name: "Unicode 😀",
      playerId: null,
    });
    const update = await fixture.request(path, "gm", "PATCH", {
      expectedRevision: 0,
      changes: { resources: { hp: 1 } },
      ignored: true,
    });
    expect(update.status).toBe(200);
    const updated = (await update.json()).character;
    expect(updated.sheet.resources.hp).toBe(1);
    expect(updated.revision).toBe(1);
    const invitation = await fixture.request(
      `/games/${fixture.ids.game}/invitations`,
      "gm",
      "POST",
      { kind: "game", ignored: true },
    );
    expect(invitation.status).toBe(200);
    const throwPath = `/games/${fixture.ids.game}/throws`;
    const roll = await fixture.request(throwPath, "gm", "POST", {
      setup: {
        type: "free",
        characterId: "gm",
        dice: [4, 20],
        modifier: 0,
        redDice: [],
        redModifier: 0,
        note: " note ",
      },
    });
    expect(roll.status).toBe(201);
    expect((await fixture.request(`${throwPath}?limit=invalid`, "gm")).status).toBe(200);
    expect((await fixture.request(`${throwPath}?limit=0`, "gm")).status).toBe(200);
    expect((await fixture.request(`${throwPath}?before=invalid`, "gm")).status).toBe(400);
    const savedRoll = await fixture.pool.query(
      "SELECT setup->>'note' AS note,author_account_id FROM throws WHERE game_id=$1",
      [fixture.ids.game],
    );
    expect(savedRoll.rows).toEqual([{ note: "note", author_account_id: fixture.ids.gm }]);
  });

  it("API-VAL-04 retains stale revision and revocation enforcement after parsing", async () => {
    const path = `/games/${fixture.ids.game}/characters/${fixture.ids.playerCharacter}`;
    expect(
      (
        await fixture.request(path, "player", "PATCH", {
          expectedRevision: 0,
          changes: { name: "Owned" },
        })
      ).status,
    ).toBe(200);
    const beforeStale = await persisted();
    expect(
      (
        await fixture.request(path, "player", "PATCH", {
          expectedRevision: 0,
          changes: { name: "Stale" },
        })
      ).status,
    ).toBe(409);
    expect(await persisted()).toEqual(beforeStale);
    expect(
      (
        await fixture.request(
          `/games/${fixture.ids.game}/members/${fixture.ids.member}/remove`,
          "gm",
          "POST",
        )
      ).status,
    ).toBe(200);
    const beforeRevoked = await persisted();
    expect(
      (
        await fixture.request(path, "player", "PATCH", {
          expectedRevision: 1,
          changes: { name: "Revoked" },
        })
      ).status,
    ).toBe(404);
    expect(await persisted()).toEqual(beforeRevoked);
  });
});
