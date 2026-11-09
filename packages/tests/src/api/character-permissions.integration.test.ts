import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API character permissions", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("character_permissions");
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it("lets players read but prevents editing, deleting, assigning, or activating another controller's sheet", async () => {
    const { ids, request } = fixture;
    const read = await request(`/games/${ids.game}/characters/${ids.gmCharacter}`, "player");
    expect(read.status).toBe(200);
    expect((await read.json()).character.canEdit).toBe(false);
    const before = await readPersistedState(fixture);
    const attempts: [string, string, unknown?][] = [
      [
        "PATCH",
        `/games/${ids.game}/characters/${ids.gmCharacter}`,
        { expectedRevision: 0, changes: { theme: "stolen" } },
      ],
      ["DELETE", `/games/${ids.game}/characters/${ids.gmCharacter}`],
      [
        "PATCH",
        `/games/${ids.game}/characters/${ids.gmCharacter}/controller`,
        { membershipId: ids.member },
      ],
      ["PUT", `/games/${ids.game}/characters/${ids.gmCharacter}/active`, { active: true }],
      [
        "PUT",
        `/games/${ids.game}/active-character`,
        { characterId: ids.gmCharacter, expectedRevision: 1 },
      ],
    ];
    for (const [method, path, body] of attempts)
      expect((await request(path, "player", method, body)).status, path).toBeOneOf([403, 404]);
    expect(await readPersistedState(fixture)).toEqual(before);
    const own = await request(
      `/games/${ids.game}/characters/${ids.playerCharacter}`,
      "player",
      "PATCH",
      {
        expectedRevision: 0,
        changes: { theme: "allowed" },
      },
    );
    expect(own.status).toBe(200);
  });

  it("rejects cross-game character identifiers even for a GM", async () => {
    const { ids, request } = fixture;
    const before = await readPersistedState(fixture);
    const attempts: [string, unknown?][] = [
      [
        `/games/${ids.game}/characters/${ids.foreignCharacter}/controller`,
        { membershipId: ids.member },
      ],
      [
        `/games/${ids.game}/characters/${ids.gmCharacter}/controller`,
        { membershipId: ids.otherMember },
      ],
    ];
    for (const [path, body] of attempts)
      expect((await request(path, "gm", "PATCH", body)).status, path).toBe(404);
    expect(await readPersistedState(fixture)).toEqual(before);
  });
});
