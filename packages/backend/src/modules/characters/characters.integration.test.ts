import { createGameAccessService } from "../games/service.ts";
import { createGameEvents } from "../events/streams.ts";
import { databaseFromPool } from "../../database/client.ts";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { applyMigrations } from "../../migrations.ts";
import { createWorkspaceCharacter, getWorkspaceCharacter, listWorkspaceCharacters, updateWorkspaceCharacter } from "./workspace-service.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `character_test_${randomUUID().replaceAll("-", "")}`;
const admin = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` }) : null;
const gameId = randomUUID();
const actor = { accountId: randomUUID(), sessionId: randomUUID() };

describe.skipIf(!url)("character workspace persistence", () => {
  beforeAll(async () => {
    await admin!.query(`CREATE SCHEMA ${schema}`);
    await applyMigrations(pool!);
    await pool!.query("INSERT INTO accounts(id,username,password_hash) VALUES($1,$2,$3)", [actor.accountId, "gm", "hash"]);
    await pool!.query("INSERT INTO games(id,name,system_id,gm_account_id) VALUES($1,$2,$3,$4)", [gameId, "Test", "fabula-ultima", actor.accountId]);
  });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin?.end();
  });

  it("creates an inactive sheet, replays creation, and persists child lists", async () => {
    const id = randomUUID();
    const created = await createWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, actor, gameId, id, "Camilla");
    expect(created.created).toBe(true);
    expect((await createWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, actor, gameId, id, "Camilla")).created).toBe(false);
    const saved = await updateWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, gameId, actor, id, 0, {
      classes: [{ id: randomUUID(), name: "Guardian", notes: "shield" }],
      skills: [{ id: randomUUID(), name: "Guard", notes: "" }],
      equipment: [{ id: randomUUID(), name: "Buckler", notes: "", priceZenit: 10, kind: "shield", equipped: true, defenseBonus: 2, magicDefenseBonus: 1, initiativeModifier: -1 }],
    });
    expect(saved.revision).toBe(1);
    expect((await getWorkspaceCharacter({ gameAccessFor: createGameAccessService, database: databaseFromPool(pool!) }, actor, gameId, id)).sheet.equipment).toHaveLength(1);
    expect((await listWorkspaceCharacters({ gameAccessFor: createGameAccessService, database: databaseFromPool(pool!) }, actor, gameId)).find((row) => row.id === id)).toMatchObject({ name: "Camilla", active: false });
  });

  it("rejects hidden games and stale saves", async () => {
    const id = randomUUID();
    await createWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, actor, gameId, id, "Race");
    const stranger = { accountId: randomUUID(), sessionId: randomUUID() };
    await expect(getWorkspaceCharacter({ gameAccessFor: createGameAccessService, database: databaseFromPool(pool!) }, stranger, gameId, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(createWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, stranger, gameId, randomUUID(), "Intruder")).rejects.toMatchObject({ code: "not_found" });
    await expect(updateWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, gameId, stranger, id, 0, { theme: "Intrusion" })).rejects.toMatchObject({ code: "not_found" });
    const results = await Promise.allSettled([
      updateWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, gameId, actor, id, 0, { theme: "A" }),
      updateWorkspaceCharacter({ gameAccessFor: createGameAccessService, events: createGameEvents(), database: databaseFromPool(pool!) }, gameId, actor, id, 0, { theme: "B" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason.code === "stale_revision")).toHaveLength(1);
  });
});
