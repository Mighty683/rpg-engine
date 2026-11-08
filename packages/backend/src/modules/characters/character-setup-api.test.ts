import { databaseFromPool } from "../../database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../../app.ts";
import { applyMigrations } from "../../migrations.ts";

describe("character setup scoped API", () => {
  it("creates Fabula games and rejects player access through another game", async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) return;
    const admin = new pg.Pool({ connectionString });
    const schema = `api_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
    await applyMigrations(pool);
    const server = createApp(databaseFromPool(pool)).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const base = `http://127.0.0.1:${address.port}/api`;
    try {
      const created = await fetch(`${base}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Fabula", systemId: "fabula-ultima" }),
      });
      expect(created.status).toBe(201);
      const oversized = await fetch(`${base}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Fabula",
          systemId: "fabula-ultima",
          padding: "x".repeat(100_000),
        }),
      });
      expect(oversized.status).toBe(413);
      expect((await oversized.json()).error.code).toBe("payload_too_large");
      const game = (await created.json()).game;
      expect((await fetch(`${base}/games/not-a-uuid`)).status).toBe(400);
      const retiredId = randomUUID();
      await pool.query("INSERT INTO games(id,name,system_id) VALUES($1,$2,$3)", [
        retiredId,
        "Retired",
        "dnd-5e",
      ]);
      expect(
        (
          await fetch(
            `${base}/games/${retiredId}/players/${randomUUID()}/characters/${randomUUID()}`,
          )
        ).status,
      ).toBe(404);
      expect((await fetch(`${base}/games/${game.id}`)).status).toBe(200);
      const playerId = randomUUID();
      const player = await fetch(`${base}/games/${game.id}/players`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: playerId, name: "Alex" }),
      });
      expect(player.status).toBe(201);
      const replay = await fetch(`${base}/games/${game.id}/players`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: playerId, name: "Alex" }),
      });
      expect(replay.status).toBe(200);
      const otherGame = await fetch(`${base}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Other", systemId: "fabula-ultima" }),
      });
      const other = (await otherGame.json()).game;
      expect((await fetch(`${base}/games/${other.id}/players/${playerId}`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }, 30_000);
});
