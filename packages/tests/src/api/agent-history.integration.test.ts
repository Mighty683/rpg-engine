import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

describe("GM Agent admission and history", () => {
  let f: ApiFixture;
  beforeAll(async () => {
    f = await createApiFixture("agent_history", { appOrigin: "https://table.example" });
  });
  afterAll(async () => {
    await f?.cleanup();
  });

  it("GM-API-01 enforces session, game ownership, Origin and CSRF before Agent work", async () => {
    const base = `/games/${f.ids.game}/agent`;
    for (const [identity, status] of [
      [null, 401],
      ["player", 403],
      ["outsider", 404],
    ] as const) {
      expect((await f.request(base + "/status", identity)).status).toBe(status);
      expect(
        (await f.request(base + "/turns", identity, "POST", { message: "hello" })).status,
      ).toBe(status);
    }
    expect(
      (
        await f.request(
          base + "/turns",
          "gm",
          "POST",
          { message: "hello" },
          "https://elsewhere.invalid",
        )
      ).status,
    ).toBe(403);
    const csrf = await fetch(f.origin + "/api" + base + "/turns", {
      method: "POST",
      headers: {
        origin: "https://table.example",
        cookie: "rpg_session=" + f.tokens.gm,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(csrf.status).toBe(403);
    const disabled = await f.request(base + "/turns", "gm", "POST", { message: "hello" });
    expect(disabled.status).toBe(503);
    expect((await disabled.json()).error.code).toBe("ERR01");
    const empty = await f.request(base + "/status", "gm");
    expect(empty.headers.get("cache-control")).toBe("no-store");
    expect(await empty.json()).toEqual({
      available: false,
      busy: false,
      nextBefore: null,
      turns: [],
    });
  });

  it("rejects malformed turn bodies and history queries before Agent work", async () => {
    const base = `/games/${f.ids.game}/agent`;
    for (const [body, status] of [
      [{ message: "  " }, 422],
      [{ message: "a".repeat(2001) }, 422],
      [{ message: "Roll", unexpected: true }, 400],
    ] as const) {
      expect((await f.request(base + "/turns", "gm", "POST", body)).status).toBe(status);
    }
    for (const query of ["limit=0", "limit=latest", `before=${f.ids.game}&before=${f.ids.game}`]) {
      expect((await f.request(base + "/status?" + query, "gm")).status).toBe(400);
    }
    const valid = await f.request(base + "/turns", "gm", "POST", { message: "a".repeat(2000) });
    expect(valid.status).toBe(503);
  });

  it("GM-API-10 pages a scoped transcript across concurrent appends", async () => {
    const base = `/games/${f.ids.game}/agent/status`;
    const insert = async (game: string, gm: string, count: number) =>
      (
        await f.pool.query<{ id: string }>(
          "INSERT INTO agent_turns (id,game_id,gm_account_id,author,message,reply,tools) SELECT gen_random_uuid(),$1,$2,'GM',i::text,'Reply','[]'::jsonb FROM generate_series(1,$3::integer) AS i RETURNING id",
          [game, gm, count],
        )
      ).rows.map((row) => row.id);
    const ids = await insert(f.ids.game, f.ids.gm, 55);
    const [foreign] = await insert(f.ids.otherGame, f.ids.outsider, 1);
    const page = async (query: string) => {
      const response = await f.request(base + query, "gm");
      expect(response.status).toBe(200);
      return (await response.json()) as { turns: { id: string }[]; nextBefore: string | null };
    };
    const latest = await page("");
    expect(latest.turns.map((t) => t.id)).toEqual(ids.slice(35));
    expect(latest.nextBefore).toBe(ids[35]);
    const [newId] = await insert(f.ids.game, f.ids.gm, 1);
    const older = await page("?before=" + latest.nextBefore + "&limit=50");
    expect(older.turns.map((t) => t.id)).toEqual(ids.slice(0, 35));
    expect(older.nextBefore).toBeNull();
    expect((await page("?limit=50")).turns.map((t) => t.id)).toEqual([...ids.slice(6), newId]);
    expect((await page("?before=" + ids[0])).turns).toEqual([]);
    for (const cursor of [foreign, randomUUID()])
      expect((await f.request(base + "?before=" + cursor, "gm")).status).toBe(404);
    expect((await f.request(base + "?limit=51", "gm")).status).toBe(400);
  });
});
