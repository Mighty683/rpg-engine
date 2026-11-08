import { withPasswordHashCapacity } from "../../../backend/src/modules/auth/hash-capacity.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, csrfHeaders, type ApiFixture } from "./fixtures.ts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API security middleware", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("security");
  });
  afterAll(async () => {
    await fixture.cleanup();
  });

  it("requires a session-bound CSRF token for writes and supplies security headers", async () => {
    const { origin, ids, tokens, pool } = fixture;
    const cookie = `rpg_session=${tokens.gm}`;
    const target = `${origin}/api/games/${ids.game}/characters/${ids.gmCharacter}`;
    const missing = await fetch(target, { method: "DELETE", headers: { cookie, origin } });
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe("invalid_csrf");
    expect(missing.headers.get("x-content-type-options")).toBe("nosniff");
    const wrong = await csrfHeaders(origin, `rpg_session=${tokens.player}`);
    const mismatch = await fetch(target, {
      method: "DELETE",
      headers: { ...wrong, cookie: `${cookie}; ${wrong.cookie}`, origin },
    });
    expect(mismatch.status).toBe(403);
    expect(
      (await pool.query("SELECT id FROM characters WHERE id=$1", [ids.gmCharacter])).rowCount,
    ).toBe(1);
  });

  it("does not let a successful login reset attempts for another account", async () => {
    const { request } = fixture;
    expect(
      (
        await request("/auth/register", null, "POST", {
          username: "attacker",
          password: "password-123",
        })
      ).status,
    ).toBe(201);
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(
        (
          await request("/auth/login", null, "POST", {
            username: "victim",
            password: "wrong-password",
          })
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await request("/auth/login", null, "POST", {
          username: "attacker",
          password: "password-123",
        })
      ).status,
    ).toBe(200);
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(
        (
          await request("/auth/login", null, "POST", {
            username: "victim",
            password: "wrong-password",
          })
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await request("/auth/login", null, "POST", {
          username: "victim",
          password: "wrong-password",
        })
      ).status,
    ).toBe(429);
  }, 20_000);

  it("returns an availability response when password hashing capacity is exhausted", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const jobs = Array.from({ length: 4 }, () => withPasswordHashCapacity(() => gate));
    try {
      const response = await fixture.request("/auth/register", null, "POST", {
        username: "busyuser",
        password: "password-123",
      });
      expect(response.status).toBe(503);
    } finally {
      release();
      await Promise.all(jobs);
    }
  });

  it("limits registration before expensive password hashing", async () => {
    const isolated = await createApiFixture("security_registration");
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        expect(
          (
            await isolated.request("/auth/register", null, "POST", {
              username: "x",
              password: "short",
            })
          ).status,
        ).toBe(422);
      }
      expect(
        (
          await isolated.request("/auth/register", null, "POST", {
            username: "x",
            password: "short",
          })
        ).status,
      ).toBe(429);
    } finally {
      await isolated.cleanup();
    }
  });
});
