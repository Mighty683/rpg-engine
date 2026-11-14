import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { createApiFixture, readPersistedState, type ApiFixture } from "./fixtures.ts";

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Stream did not respond")), 2000);
      }),
    ]);
    return result.done ? null : new TextDecoder().decode(result.value);
  } finally {
    clearTimeout(timer);
  }
}

describe("API event capacity, revocation, and private delivery", () => {
  let fixture: ApiFixture;
  const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];

  beforeEach(async () => {
    fixture = await createApiFixture("events_capacity", {
      application: { eventStreams: { maxConnectionsPerAccount: 2, maxConnections: 3 } },
    });
  });
  afterEach(async () => {
    await Promise.allSettled(readers.splice(0).map((reader) => reader.cancel()));
    await fixture?.cleanup();
  });

  async function open(actor: string, gameId = fixture.ids.game) {
    const response = await fixture.request(`/games/${gameId}/events`, actor);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    readers.push(reader);
    expect(await readChunk(reader)).toContain(": connected");
    return reader;
  }

  it("API-EVENT-01: bounds accounts across sessions and global capacity across games, then reclaims slots", async () => {
    const { ids, request, pool } = fixture;
    const before = await readPersistedState(fixture);
    expect((await request(`/games/${ids.game}/events`, null)).status).toBe(401);
    expect((await request(`/games/${ids.game}/events`, "outsider")).status).toBe(404);
    const secondSession = await createSession(
      databaseFromPool(pool),
      ids.gm,
      new Date(Date.now() + 60_000),
    );
    const first = await open("gm");
    await open(secondSession.token);
    const excessAccount = await request(`/games/${ids.game}/events`, "gm");
    expect(excessAccount.status).toBe(429);
    expect(excessAccount.headers.get("content-type")).toContain("application/json");
    expect(excessAccount.headers.get("retry-after")).toBe("15");
    expect(await excessAccount.json()).toEqual({
      error: { code: "stream_capacity", message: "Too many live connections." },
    });
    await open("player");
    const excessGlobal = await request(`/games/${ids.otherGame}/events`, "outsider");
    expect(excessGlobal.status).toBe(429);
    await excessGlobal.json();
    await first.cancel();
    let replacement: Response | undefined;
    await expect
      .poll(async () => {
        replacement = await request(`/games/${ids.otherGame}/events`, "outsider");
        if (replacement.status !== 200) await replacement.json();
        return replacement.status;
      })
      .toBe(200);
    const reader = replacement!.body!.getReader();
    readers.push(reader);
    expect(await readChunk(reader)).toContain(": connected");
    expect(await readPersistedState(fixture)).toEqual(before);
  });

  it("API-EVENT-02/03: isolates private hints and revokes only affected sessions or members", async () => {
    const { ids, request, pool } = fixture;
    const secondSession = await createSession(
      databaseFromPool(pool),
      ids.gm,
      new Date(Date.now() + 60_000),
    );
    const gm = await open("gm");
    const otherGmSession = await open(secondSession.token);
    const player = await open("player");
    const response = await request(`/games/${ids.game}/throws`, "gm", "POST", {
      private: true,
      setup: {
        type: "free",
        characterId: "gm",
        dice: [8],
        modifier: 0,
        redDice: [],
        redModifier: 0,
        note: "",
      },
    });
    expect(response.status).toBe(201);
    expect(await readChunk(gm)).toBe('data: {"type":"throws"}\n\n');
    expect(await readChunk(otherGmSession)).toBe('data: {"type":"throws"}\n\n');
    // A public roster hint is an ordering marker: the player's first hint must not be the private throw.
    expect(
      (
        await request(`/games/${ids.game}/characters/${ids.gmCharacter}/active`, "gm", "PUT", {
          active: true,
        })
      ).status,
    ).toBe(200);
    expect(await readChunk(player)).toBe('data: {"type":"roster"}\n\n');
    await readChunk(gm);
    await readChunk(otherGmSession);
    expect((await request("/auth/logout", "gm", "POST")).status).toBe(200);
    expect(await readChunk(gm)).toBeNull();
    expect(
      (
        await request(
          `/games/${ids.game}/members/${ids.member}/remove`,
          secondSession.token,
          "POST",
        )
      ).status,
    ).toBe(200);
    expect(await readChunk(player)).toBeNull();
    expect(await readChunk(otherGmSession)).toBe('data: {"type":"roster"}\n\n');
    const afterRemoval = await readPersistedState(fixture);
    expect((await request(`/games/${ids.game}`, "gm")).status).toBe(401);
    expect((await request(`/games/${ids.game}`, "player")).status).toBe(404);
    expect(
      (await request(`/games/${ids.game}/characters/${ids.playerCharacter}`, "player", "DELETE"))
        .status,
    ).toBe(404);
    expect(await readPersistedState(fixture)).toEqual(afterRemoval);
    const history = await pool.query("SELECT count(*)::int AS count FROM throws WHERE game_id=$1", [
      ids.game,
    ]);
    expect(history.rows[0].count).toBe(1);
  });
});
