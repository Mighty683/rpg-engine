import { createGameAccessService } from "../../../backend/src/modules/games/service.ts";
import { createGameEvents } from "../../../backend/src/modules/events/streams.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import pg, { type Pool } from "pg";
import { vi } from "vite-plus/test";
import { createApp } from "../../../backend/src/app.ts";
import { applyMigrations } from "../../../backend/src/migrations.ts";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import { createWorkspaceCharacter } from "../../../backend/src/modules/characters/workspace-service.ts";

export type ApiRequest = (
  path: string,
  actor: string | null,
  method?: string,
  body?: unknown,
  requestOrigin?: string | null,
) => Promise<Response>;

export type ApiFixtureIds = {
  gm: string;
  player: string;
  outsider: string;
  game: string;
  otherGame: string;
  member: string;
  otherMember: string;
  gmCharacter: string;
  playerCharacter: string;
  foreignCharacter: string;
};

export type ApiFixture = {
  schema: string;
  pool: Pool;
  admin: Pool;
  server: Server;
  origin: string;
  request: ApiRequest;
  tokens: Record<string, string>;
  ids: ApiFixtureIds;
  cleanup: () => Promise<void>;
};

/** Seeds three accounts with sessions, two games, two memberships, and GM, player, and foreign characters. */
async function seedStandardFixture(pool: Pool) {
  const gm = randomUUID();
  const player = randomUUID();
  const outsider = randomUUID();
  const game = randomUUID();
  const otherGame = randomUUID();
  const member = randomUUID();
  const otherMember = randomUUID();
  const gmCharacter = randomUUID();
  const playerCharacter = randomUUID();
  const foreignCharacter = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,username,password_hash) VALUES ($1,$2,'hash'),($3,$4,'hash'),($5,$6,'hash')",
    [gm, gm, player, player, outsider, outsider],
  );
  await pool.query(
    "INSERT INTO games(id,name,system_id,gm_account_id) VALUES ($1,'Game','fabula-ultima',$2),($3,'Other','fabula-ultima',$4)",
    [game, gm, otherGame, outsider],
  );
  await pool.query(
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
      database: databaseFromPool(pool),
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
      database: databaseFromPool(pool),
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
      database: databaseFromPool(pool),
    },
    actors.outsider,
    otherGame,
    foreignCharacter,
    "Foreign sheet",
  );
  const tokens: Record<string, string> = {};
  for (const [name, actor] of Object.entries(actors))
    tokens[name] = (
      await createSession(databaseFromPool(pool), actor.accountId, new Date(Date.now() + 60_000))
    ).token;
  const ids: ApiFixtureIds = {
    gm,
    player,
    outsider,
    game,
    otherGame,
    member,
    otherMember,
    gmCharacter,
    playerCharacter,
    foreignCharacter,
  };
  return { ids, tokens };
}

/** Reads the persisted character and membership rows the permission suites compare before and after rejected writes. */
export async function readPersistedState(fixture: Pick<ApiFixture, "pool" | "ids">) {
  const { pool, ids } = fixture;
  const characters = await pool.query(
    "SELECT id,game_id,player_id,name,theme,revision,gm_active FROM characters WHERE id=ANY($1::uuid[]) ORDER BY id",
    [[ids.gmCharacter, ids.playerCharacter, ids.foreignCharacter]],
  );
  const members = await pool.query(
    "SELECT id,removed,active_character_id,revision FROM players WHERE id=ANY($1::uuid[]) ORDER BY id",
    [[ids.member, ids.otherMember]],
  );
  return { characters: characters.rows, members: members.rows };
}

export async function csrfHeaders(origin: string, cookie = "") {
  const response = await fetch(`${origin}/api/auth/csrf`, { headers: cookie ? { cookie } : {} });
  if (!response.ok) throw new Error("Failed to acquire CSRF token");
  const { csrfToken } = (await response.json()) as { csrfToken: string };
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { cookie: [cookie, cookies].filter(Boolean).join("; "), "x-csrf-token": csrfToken };
}

/**
 * Boots one isolated API suite: a schema named after the calling suite, migrations, an app on an
 * ephemeral port, stubbed env, and the standard seeded fixture. Suites call this in `beforeAll` and
 * `cleanup` in `afterAll`.
 */
export async function createApiFixture(
  suite: string,
  options: { appOrigin?: string } = {},
): Promise<ApiFixture> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "Set TEST_DATABASE_URL to a disposable PostgreSQL database for API integration tests",
    );
  const schema = `${suite.replaceAll(/[^a-z0-9]+/gi, "_")}_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: url });
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  vi.stubEnv("INVITATION_SECRET", "integration-test-secret-at-least-32-bytes");
  vi.stubEnv("APP_ORIGIN", options.appOrigin ?? "");
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await applyMigrations(pool);
  const server = createApp(databaseFromPool(pool)).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The API server has no TCP address");
  const origin = `http://127.0.0.1:${address.port}`;
  const { ids, tokens } = await seedStandardFixture(pool);
  const request: ApiRequest = async (
    path,
    actor,
    method = "GET",
    body,
    requestOrigin = options.appOrigin ?? origin,
  ) => {
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
  };
  const cleanup = async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    vi.unstubAllEnvs();
  };
  return { schema, pool, admin, server, origin, request, tokens, ids, cleanup };
}
