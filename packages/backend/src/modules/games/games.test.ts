import { databaseFromPool } from "../../database/client.ts";
import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../../app.ts";
import { validateGame } from "./service.ts";
import type { Pool } from "pg";

describe("game input", () => {
  it.each([
    [{ name: "  Adventure  ", systemId: "fabula-ultima" }, "Adventure", {}],
    [
      { name: "   ", systemId: "unknown" },
      "",
      { name: "Enter a game name", systemId: "Select an RPG system" },
    ],
    [
      { name: "a".repeat(21), systemId: "fabula-ultima" },
      "a".repeat(21),
      { name: "Use 20 characters or fewer" },
    ],
  ])("validates %j", (input, name, fields) => {
    expect(validateGame(input)).toMatchObject({ name, fields });
  });
});

describe("game API", () => {
  it("distinguishes an empty list, failed list, invalid input and saved game", async () => {
    let fail = false;
    const query = async (sql: string, args?: string[]) => {
      if (fail) throw new Error("database unavailable");
      if (sql.startsWith("SELECT")) return { rows: [] };
      return {
        rows: [
          {
            id: args![0],
            name: args![1],
            system_id: args![2],
            created_at: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      };
    };
    const server = createApp(databaseFromPool({ query } as unknown as Pool)).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    const url = `http://127.0.0.1:${address.port}/api/games`;
    try {
      expect(await (await fetch(url)).json()).toEqual({ games: [] });
      const systems = await fetch(`http://127.0.0.1:${address.port}/api/rpg-systems`);
      expect(await systems.json()).toEqual({
        systems: [{ id: "fabula-ultima", name: "Fabula Ultima" }],
      });
      const malformed = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      expect(malformed.status).toBe(400);
      expect((await malformed.json()).error.code).toBe("bad_request");
      const invalid = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", systemId: "bad" }),
      });
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).error.fields).toEqual({
        name: "Enter a game name",
        systemId: "Select an RPG system",
      });
      const created = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: " Test ", systemId: "fabula-ultima" }),
      });
      expect(created.status).toBe(201);
      expect((await created.json()).game).toMatchObject({
        name: "Test",
        system: { id: "fabula-ultima" },
      });
      fail = true;
      const failed = await fetch(url);
      expect(failed.status).toBe(500);
      expect((await failed.json()).error.code).toBe("list_failed");
      const failedSave = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", systemId: "fabula-ultima" }),
      });
      expect(failedSave.status).toBe(500);
      expect((await failedSave.json()).error.code).toBe("save_failed");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
