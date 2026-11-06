import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API session and origin guards", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("session_origin");
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("rejects missing or hostile origins without changing state", async () => {
    const { ids, request, origin } = fixture;
    const before = await readPersistedState(fixture);
    for (const badOrigin of [null, "https://attacker.example", `${origin}.attacker.example`]) {
      expect(
        (
          await request(
            `/games/${ids.game}/characters/${ids.gmCharacter}`,
            "gm",
            "DELETE",
            undefined,
            badOrigin,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/games/${ids.game}/members/${ids.member}/remove`,
            "gm",
            "POST",
            undefined,
            badOrigin,
          )
        ).status,
      ).toBe(403);
    }
    expect(await readPersistedState(fixture)).toEqual(before);
  });

  it("does not allow a revoked session to read or mutate protected resources", async () => {
    const { ids, request } = fixture;
    const before = await readPersistedState(fixture);
    expect((await request("/auth/logout", "gm", "POST")).status).toBe(200);
    expect((await request(`/games/${ids.game}`, "gm")).status).toBe(401);
    expect(
      (await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "gm", "DELETE")).status,
    ).toBe(401);
    expect(await readPersistedState(fixture)).toEqual(before);
  });
});
