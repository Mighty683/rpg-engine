import { createGameAccessService } from "../games/service.ts";
import { createGameEvents } from "../events/streams.ts";
import { databaseFromPool } from "../../database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { createApp } from "../../app.ts";
import { createSession } from "../auth/sessions.ts";
import { createWorkspaceCharacter } from "../characters/workspace-service.ts";
import { selectPlayerCharacter } from "./membership.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `active_test_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` })
  : null;
const gameId = randomUUID();
const gm = { accountId: randomUUID(), sessionId: randomUUID() };
const player = { accountId: randomUUID(), sessionId: randomUUID() };
const other = { accountId: randomUUID(), sessionId: randomUUID() };
const membershipId = randomUUID();
const otherMembershipId = randomUUID();

describe.skipIf(!url)("player active character selection", () => {
  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA "${schema}"`);
    await applyMigrations(pool!);
    await pool!.query(
      "INSERT INTO accounts(id,username,password_hash) VALUES ($1,'gm','hash'),($2,'player','hash'),($3,'other','hash')",
      [gm.accountId, player.accountId, other.accountId],
    );
    await pool!.query(
      "INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,'Game','fabula-ultima',$2)",
      [gameId, gm.accountId],
    );
    await pool!.query(
      "INSERT INTO players(id,game_id,account_id,name) VALUES ($1,$2,$3,'Player'),($4,$2,$5,'Other')",
      [membershipId, gameId, player.accountId, otherMembershipId, other.accountId],
    );
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin?.end();
  });

  it("lets the GM select and clear a player's slot while preserving ownership and checking authority", async () => {
    const first = randomUUID();
    const second = randomUUID();
    const otherCharacter = randomUUID();
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      player,
      gameId,
      first,
      "Nera",
    );
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      player,
      gameId,
      second,
      "Ellis",
    );
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      other,
      gameId,
      otherCharacter,
      "Rowan",
    );
    const changed = await selectPlayerCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      gm,
      gameId,
      1,
      second,
      membershipId,
    );
    expect(changed).toMatchObject({ activeCharacterId: second, revision: 2 });
    await expect(
      selectPlayerCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool!),
        },
        player,
        gameId,
        2,
        first,
        membershipId,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      selectPlayerCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool!),
        },
        gm,
        gameId,
        1,
        first,
        membershipId,
      ),
    ).rejects.toMatchObject({ code: "stale_revision" });
    await expect(
      selectPlayerCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool!),
        },
        gm,
        gameId,
        2,
        otherCharacter,
        membershipId,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(
      await selectPlayerCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool!),
        },
        gm,
        gameId,
        2,
        null,
        membershipId,
      ),
    ).toMatchObject({ activeCharacterId: null, revision: 3 });
    const ownership = await pool!.query(
      "SELECT player_id FROM characters WHERE id=ANY($1::uuid[]) ORDER BY player_id",
      [[first, second]],
    );
    expect(ownership.rows).toEqual([{ player_id: membershipId }, { player_id: membershipId }]);
    expect(
      await selectPlayerCharacter(
        {
          gameAccessFor: createGameAccessService,
          events: createGameEvents(),
          database: databaseFromPool(pool!),
        },
        player,
        gameId,
        3,
        first,
      ),
    ).toMatchObject({ activeCharacterId: first, revision: 4 });
  });

  it("allows the GM endpoint and denies another player before changing the slot", async () => {
    const characterId = randomUUID();
    await createWorkspaceCharacter(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool!),
      },
      player,
      gameId,
      characterId,
      "Aria",
    );
    const result = await pool!.query<{ revision: number }>(
      "SELECT revision FROM players WHERE id=$1",
      [membershipId],
    );
    const revision = result.rows[0]!.revision;
    const gmSession = await createSession(
      databaseFromPool(pool!),
      gm.accountId,
      new Date(Date.now() + 60_000),
    );
    const otherSession = await createSession(
      databaseFromPool(pool!),
      other.accountId,
      new Date(Date.now() + 60_000),
    );
    const server = createApp(databaseFromPool(pool!)).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const origin = `http://127.0.0.1:${address.port}`;
    const select = async (token: string) => {
      const session = `rpg_session=${token}`;
      const csrf = await fetch(`${origin}/api/auth/csrf`, { headers: { cookie: session } });
      const { csrfToken } = (await csrf.json()) as { csrfToken: string };
      const cookie = csrf.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      return fetch(`${origin}/api/games/${gameId}/members/${membershipId}/active-character`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin,
          cookie: `${session}; ${cookie}`,
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ characterId, expectedRevision: revision }),
      });
    };
    try {
      expect((await select(otherSession.token)).status).toBe(403);
      const response = await select(gmSession.token);
      expect(response.status).toBe(200);
      expect((await response.json()).member).toMatchObject({
        activeCharacterId: characterId,
        revision: revision + 1,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
