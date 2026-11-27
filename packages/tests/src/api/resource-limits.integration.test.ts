import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { createSession } from "../../../backend/src/modules/auth/sessions.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

let fixture: ApiFixture;
beforeEach(async () => {
  fixture = await createApiFixture("resource_limits", {
    appOrigin: "http://allowed.example",
    application: { mutationLimits: { limit: 2, windowMs: 60000 } },
  });
});
afterEach(async () => fixture?.cleanup());

it("shares a mutation budget across sessions and routes, isolates accounts, and rejects before writes", async () => {
  const { request, ids, pool } = fixture;
  const body = { name: "Budget", systemId: "fabula-ultima" };
  expect((await request("/games", null, "POST", body)).status).toBe(401);
  expect((await request("/games", "gm", "POST", body, "http://evil.example")).status).toBe(403);
  expect((await pool.query("SELECT * FROM sign_in_attempts")).rows).toEqual([]);
  expect((await request("/games", "gm", "POST", body)).status).toBe(201);
  const session = await createSession(databaseFromPool(pool), ids.gm, new Date(Date.now() + 60000));
  const characterId = randomUUID();
  expect(
    (
      await request(`/games/${ids.game}/characters`, session.token, "POST", {
        id: characterId,
        name: "Within budget",
      })
    ).status,
  ).toBe(201);
  const rejectedId = randomUUID();
  const rejected = await request(`/games/${ids.game}/characters`, "gm", "POST", {
    id: rejectedId,
    name: "Over budget",
  });
  expect(rejected.status).toBe(429);
  expect(Number(rejected.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(rejected.headers.get("x-request-id")).toBeTruthy();
  expect(await rejected.json()).toMatchObject({ error: { code: "ERR86" } });
  expect((await pool.query("SELECT id FROM characters WHERE id=$1", [rejectedId])).rows).toEqual(
    [],
  );
  expect(
    (
      await pool.query("SELECT request_id FROM character_create_requests WHERE request_id=$1", [
        rejectedId,
      ])
    ).rows,
  ).toEqual([]);
  expect((await request(`/games/${ids.game}/invitations`, "gm", "POST", {})).status).toBe(429);
  expect((await pool.query("SELECT id FROM invitations")).rows).toEqual([]);
  expect((await request("/games", "gm")).status).toBe(200);
  expect((await request("/games", "outsider", "POST", body)).status).toBe(201);
  // Advance the persisted window without waiting or weakening the production policy.
  await pool.query("UPDATE sign_in_attempts SET window_started_at=now()-interval '2 minutes'");
  expect(
    (
      await request(`/games/${ids.game}/characters`, "gm", "POST", {
        id: rejectedId,
        name: "New window",
      })
    ).status,
  ).toBe(201);
  expect((await request("/auth/logout", "gm", "POST", {})).status).toBe(200);
});
