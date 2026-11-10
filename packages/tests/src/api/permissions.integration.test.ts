import { createGameAccessService } from "../../../backend/src/modules/games/service.ts";
import { createGameEvents } from "../../../backend/src/modules/events/streams.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { csrfHeaders } from "./fixtures.ts";
import { createApp } from "../../../backend/src/app.ts";
import { applyMigrations } from "../../../backend/src/migrations.ts";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import { createWorkspaceCharacter } from "../../../backend/src/modules/characters/workspace-service.ts";

const url = process.env.TEST_DATABASE_URL;
// Strict origin enforcement is tested with an explicit APP_ORIGIN; unset APP_ORIGIN in
// development intentionally accepts any origin (covered by guards unit tests).
const appOrigin = "http://localhost:5173";
const schema = `permissions_test_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` })
  : null;
let server: Server;
let origin: string;
let game: string;
let otherGame: string;
let member: string;
let otherMember: string;
let gmCharacter: string;
let playerCharacter: string;
let foreignCharacter: string;
let tokens: Record<string, string>;

async function request(
  path: string,
  actor: string | null,
  method = "GET",
  body?: unknown,
  requestOrigin: string | null = appOrigin,
) {
  const headers: Record<string, string> = {};
  if (actor) headers.cookie = `rpg_session=${tokens[actor] ?? actor}`;
  if (requestOrigin) headers.origin = requestOrigin;
  if (method !== "GET" && method !== "HEAD")
    Object.assign(headers, await csrfHeaders(origin, headers.cookie));
  if (body !== undefined) headers["content-type"] = "application/json";
  return fetch(`${origin}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function characterState() {
  const result = await pool!.query(
    "SELECT id,game_id,player_id,name,theme,revision,gm_active FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id",
    [[gmCharacter, playerCharacter, foreignCharacter]],
  );
  const members = await pool!.query(
    "SELECT id,removed,active_character_id,revision FROM players WHERE id=ANY($1::uuid[]) ORDER BY id",
    [[member, otherMember]],
  );
  return { characters: result.rows, members: members.rows };
}

async function waitForBlockedGameLock(blockerPid: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await admin!.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid)) AND query ILIKE '%FOR UPDATE%'
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]!.blocked) return;
  }
  throw new Error("The API write did not wait for the game lock");
}

describe.skipIf(!url)("API permission boundaries", () => {
  beforeAll(async () => {
    vi.stubEnv("INVITATION_SECRET", "integration-test-secret-at-least-32-bytes");
    vi.stubEnv("APP_ORIGIN", appOrigin);
    await admin!.query(`CREATE SCHEMA "${schema}"`);
    await applyMigrations(pool!);
    server = createApp(databaseFromPool(pool!)).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    origin = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    const gm = randomUUID();
    const player = randomUUID();
    const outsider = randomUUID();
    game = randomUUID();
    otherGame = randomUUID();
    member = randomUUID();
    otherMember = randomUUID();
    gmCharacter = randomUUID();
    playerCharacter = randomUUID();
    foreignCharacter = randomUUID();
    await pool!.query(
      "INSERT INTO accounts(id,username,password_hash) VALUES ($1,$2,'hash'),($3,$4,'hash'),($5,$6,'hash')",
      [gm, gm, player, player, outsider, outsider],
    );
    await pool!.query(
      "INSERT INTO games(id,name,system_id,gm_account_id) VALUES ($1,'Game','fabula-ultima',$2),($3,'Other','fabula-ultima',$4)",
      [game, gm, otherGame, outsider],
    );
    await pool!.query(
      "INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,'Player'),($4,$5,$6,'Player')",
      [member, game, player, otherMember, otherGame, player],
    );
    const actors = {
      gm: { accountId: gm, sessionId: randomUUID() },
      player: { accountId: player, sessionId: randomUUID() },
      outsider: { accountId: outsider, sessionId: randomUUID() },
    };
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      actors.gm,
      game,
      gmCharacter,
      "GM sheet",
    );
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      actors.player,
      game,
      playerCharacter,
      "Player sheet",
    );
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      actors.outsider,
      otherGame,
      foreignCharacter,
      "Foreign sheet",
    );
    tokens = {};
    for (const [name, actor] of Object.entries(actors))
      tokens[name] = (
        await createSession(databaseFromPool(pool!), actor.accountId, new Date(Date.now() + 60_000))
      ).token;
  });

  afterAll(async () => {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.end();
    vi.unstubAllEnvs();
  });

  it("rejects anonymous, invalid-session, and non-member access across game resources", async () => {
    for (const actor of [null, "invalid-session"]) {
      expect((await request(`/games/${game}`, actor)).status).toBe(401);
      expect((await request(`/games/${game}/characters/${gmCharacter}`, actor)).status).toBe(401);
      expect(
        (await request(`/games/${game}/characters/${gmCharacter}`, actor, "DELETE")).status,
      ).toBe(401);
    }
    const before = await characterState();
    for (const path of [
      `/games/${game}`,
      `/games/${game}/characters`,
      `/games/${game}/characters/${gmCharacter}`,
      `/games/${game}/members`,
      `/games/${game}/invitations`,
      `/games/${game}/events`,
    ]) {
      expect((await request(path, "outsider")).status, path).toBe(404);
    }
    expect(
      (await request(`/games/${game}/characters/${gmCharacter}`, "outsider", "DELETE")).status,
    ).toBe(404);
    expect(await characterState()).toEqual(before);
  });

  it("lets players read but prevents editing, deleting, assigning, or activating another controller's sheet", async () => {
    const read = await request(`/games/${game}/characters/${gmCharacter}`, "player");
    expect(read.status).toBe(200);
    expect((await read.json()).character.canEdit).toBe(false);
    const before = await characterState();
    const attempts: [string, string, unknown?][] = [
      [
        "PATCH",
        `/games/${game}/characters/${gmCharacter}`,
        { expectedRevision: 0, changes: { theme: "stolen" } },
      ],
      ["DELETE", `/games/${game}/characters/${gmCharacter}`],
      ["PATCH", `/games/${game}/characters/${gmCharacter}/controller`, { membershipId: member }],
      ["PUT", `/games/${game}/characters/${gmCharacter}/active`, { active: true }],
      ["PUT", `/games/${game}/active-character`, { characterId: gmCharacter, expectedRevision: 1 }],
    ];
    for (const [method, path, body] of attempts)
      expect((await request(path, "player", method, body)).status, path).toBeOneOf([403, 404]);
    expect(await characterState()).toEqual(before);
    const own = await request(`/games/${game}/characters/${playerCharacter}`, "player", "PATCH", {
      expectedRevision: 0,
      changes: { theme: "allowed" },
    });
    expect(own.status).toBe(200);
  });

  it("rejects player privilege escalation and cross-game identifiers even for a GM", async () => {
    const before = await characterState();
    const attempts: [string, string, string, unknown?][] = [
      ["player", "POST", `/games/${game}/members/${member}/remove`],
      ["player", "POST", `/games/${game}/members/${member}/restore`],
      [
        "player",
        "PUT",
        `/games/${game}/members/${member}/active-character`,
        { characterId: null, expectedRevision: 1 },
      ],
      ["player", "GET", `/games/${game}/invitations`],
      ["player", "POST", `/games/${game}/invitations`, { kind: "game" }],
      [
        "gm",
        "PATCH",
        `/games/${game}/characters/${foreignCharacter}/controller`,
        { membershipId: member },
      ],
      [
        "gm",
        "PATCH",
        `/games/${game}/characters/${gmCharacter}/controller`,
        { membershipId: otherMember },
      ],
      ["gm", "POST", `/games/${game}/members/${otherMember}/remove`],
      [
        "gm",
        "POST",
        `/games/${game}/invitations`,
        { kind: "character", characterId: foreignCharacter },
      ],
    ];
    for (const [actor, method, path, body] of attempts)
      expect((await request(path, actor, method, body)).status, path).toBe(
        actor === "player" ? 403 : 404,
      );
    expect(await characterState()).toEqual(before);
    expect(
      (await pool!.query("SELECT id FROM invitations WHERE game_id=$1", [game])).rowCount,
    ).toBe(0);
  });

  it("rejects missing or hostile origins without changing state", async () => {
    const before = await characterState();
    for (const badOrigin of [null, "https://attacker.example", `${origin}.attacker.example`]) {
      expect(
        (
          await request(
            `/games/${game}/characters/${gmCharacter}`,
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
            `/games/${game}/members/${member}/remove`,
            "gm",
            "POST",
            undefined,
            badOrigin,
          )
        ).status,
      ).toBe(403);
    }
    expect(await characterState()).toEqual(before);
  });

  it("revokes access immediately and prevents removed members from rejoining with an invitation", async () => {
    const created = await request(`/games/${game}/invitations`, "gm", "POST", { kind: "game" });
    expect(created.status).toBe(200);
    const token = (await created.json()).invitation.url.split("/").at(-1);
    expect((await request(`/games/${game}/members/${member}/remove`, "gm", "POST")).status).toBe(
      200,
    );
    const before = await characterState();
    for (const path of [
      `/games/${game}`,
      `/games/${game}/characters/${playerCharacter}`,
      `/games/${game}/events`,
      `/invitations/${token}`,
    ]) {
      expect((await request(path, "player")).status, path).toBe(404);
    }
    expect(
      (await request(`/games/${game}/characters/${playerCharacter}`, "player", "DELETE")).status,
    ).toBe(404);
    expect((await request(`/invitations/${token}/accept`, "player", "POST", {})).status).toBe(404);
    expect(await characterState()).toEqual(before);
    expect((await request(`/games/${game}/members/${member}/restore`, "gm", "POST")).status).toBe(
      200,
    );
    expect((await request(`/games/${game}/characters/${playerCharacter}`, "player")).status).toBe(
      200,
    );
    expect(
      (await request(`/games/${game}/characters/${playerCharacter}`, "player", "DELETE")).status,
    ).toBe(403);
  });

  it("invalidates old and disabled invitation tokens without granting membership", async () => {
    const created = await request(`/games/${game}/invitations`, "gm", "POST", { kind: "game" });
    const invitation = (await created.json()).invitation;
    const oldToken = invitation.url.split("/").at(-1);
    expect(
      (await request(`/games/${game}/invitations/${invitation.id}/rotate`, "player", "POST"))
        .status,
    ).toBe(403);
    const rotated = await request(
      `/games/${game}/invitations/${invitation.id}/rotate`,
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
        await request(`/games/${game}/invitations/${invitation.id}`, "gm", "PATCH", {
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
    expect((await request(`/games/${game}`, "outsider")).status).toBe(404);
    expect(
      (
        await pool!.query(
          "SELECT id FROM players WHERE game_id=$1 AND account_id=(SELECT gm_account_id FROM games WHERE id=$2)",
          [game, otherGame],
        )
      ).rowCount,
    ).toBe(0);
  });

  it("does not allow a revoked session to read or mutate protected resources", async () => {
    const before = await characterState();
    expect((await request("/auth/logout", "gm", "POST")).status).toBe(200);
    expect((await request(`/games/${game}`, "gm")).status).toBe(401);
    expect((await request(`/games/${game}/characters/${gmCharacter}`, "gm", "DELETE")).status).toBe(
      401,
    );
    expect(await characterState()).toEqual(before);
  });

  it.each(["removal", "reassignment"] as const)(
    "rechecks permission after a concurrent %s before committing a sheet write",
    async (change) => {
      const coordinator = await pool!.connect();
      let pending: Promise<Response> | undefined;
      try {
        await coordinator.query("BEGIN");
        await coordinator.query("SELECT id FROM games WHERE id=$1 FOR UPDATE", [game]);
        const blocker = await coordinator.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        const before = await coordinator.query(
          "SELECT theme,revision FROM characters WHERE id=$1",
          [playerCharacter],
        );
        pending = request(`/games/${game}/characters/${playerCharacter}`, "player", "PATCH", {
          expectedRevision: 0,
          changes: { theme: "unauthorized write" },
        });
        await waitForBlockedGameLock(blocker.rows[0]!.pid);
        if (change === "removal") {
          await coordinator.query("UPDATE players SET removed=true WHERE id=$1", [member]);
        } else {
          await coordinator.query("UPDATE players SET active_character_id=NULL WHERE id=$1", [
            member,
          ]);
          await coordinator.query("UPDATE characters SET player_id=NULL WHERE id=$1", [
            playerCharacter,
          ]);
        }
        await coordinator.query("COMMIT");
        const response = await pending;
        expect(response.status).toBe(change === "removal" ? 404 : 403);
        const after = await pool!.query("SELECT theme,revision FROM characters WHERE id=$1", [
          playerCharacter,
        ]);
        expect(after.rows).toEqual(before.rows);
      } finally {
        await coordinator.query("ROLLBACK");
        coordinator.release();
        await pending?.catch(() => undefined);
      }
    },
    10_000,
  );
});
