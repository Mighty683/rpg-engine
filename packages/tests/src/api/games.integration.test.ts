import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

describe("game API", () => {
  let fixture: ApiFixture;

  beforeAll(async () => {
    fixture = await createApiFixture("games");
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it("validates and creates games for the signed-in account", async () => {
    const { request } = fixture;
    expect((await request("/games", null)).status).toBe(401);
    const invalid = await request("/games", "gm", "POST", { name: "", systemId: "bad" });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.fields).toEqual({
      name: "Enter a game name",
      systemId: "Select an RPG system",
    });
    const created = await request("/games", "gm", "POST", {
      name: " Test ",
      systemId: "fabula-ultima",
    });
    expect(created.status).toBe(201);
    const { game } = await created.json();
    expect(game).toMatchObject({ name: "Test", system: { id: "fabula-ultima" } });
    const list = await request("/games", "gm");
    expect((await list.json()).games).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: game.id })]),
    );
    expect((await request(`/games/${game.id}`, "outsider")).status).toBe(404);
    expect((await request("/games/not-a-uuid", "gm")).status).toBe(400);
  });
});
