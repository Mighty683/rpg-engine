import { describe, expect, it, beforeAll, afterAll } from "vite-plus/test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { applyMigrations } from "../../migrations.ts";
import { createCharacter, getCharacter, listCharacters, updateCharacter } from "./service.ts";

const url = process.env.TEST_DATABASE_URL;
const schema = `character_test_${randomUUID().replaceAll("-", "")}`;
const base = url ? new pg.Pool({ connectionString: url }) : null;
const pool = url
  ? new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` })
  : null;
const gameId = randomUUID();
const playerId = randomUUID();

describe.skipIf(!url)("characters persistence", () => {
  beforeAll(async () => {
    await base!.query(`CREATE SCHEMA ${schema}`);
    await applyMigrations(pool!);
    await pool!.query("INSERT INTO games(id,name,system_id) VALUES($1,$2,$3)", [
      gameId,
      "Test",
      "fabula-ultima",
    ]);
    await pool!.query("INSERT INTO players(id,game_id,name) VALUES($1,$2,$3)", [
      playerId,
      gameId,
      "Player",
    ]);
  });

  afterAll(async () => {
    await pool?.end();
    await base?.query(`DROP SCHEMA ${schema} CASCADE`);
    await base?.end();
  });

  it("creates, replays, lists, scopes, and persists every child list", async () => {
    const id = randomUUID();
    const created = await createCharacter(pool!, gameId, playerId, id, "  Camilla  ");
    expect(created.created).toBe(true);
    expect(created.record.sheet).toMatchObject({
      name: "Camilla",
      level: 5,
      resources: { hp: 35, mp: 45, ip: 6, fabula: 3 },
    });
    const replay = await createCharacter(pool!, gameId, playerId, id, "Ignored");
    expect(replay.created).toBe(false);
    expect(replay.record.name).toBe("Camilla");

    const equipmentId = randomUUID();
    const saved = await updateCharacter(pool!, gameId, playerId, id, 0, {
      classes: [{ id: randomUUID(), name: "Guardian", notes: "shield" }],
      skills: [{ id: randomUUID(), name: "Guard", notes: "" }],
      equipment: [
        {
          id: equipmentId,
          name: "Buckler",
          notes: "",
          priceZenit: 10,
          kind: "shield",
          equipped: true,
          defenseBonus: 2,
          magicDefenseBonus: 1,
          initiativeModifier: -1,
        },
      ],
    });
    expect(saved.revision).toBe(1);
    expect(saved.sheet.classes).toHaveLength(1);
    expect(saved.sheet.skills).toHaveLength(1);
    expect(saved.sheet.equipment[0]).toMatchObject({ id: equipmentId, kind: "shield" });
    expect((await listCharacters(pool!, gameId, playerId))[0]).toMatchObject({
      id,
      name: "Camilla",
    });
    expect((await getCharacter(pool!, gameId, playerId, id))?.sheet.equipment).toHaveLength(1);
  });

  it("rejects cross-player access, preserves no-op revisions, and rejects stale races", async () => {
    const otherPlayer = randomUUID();
    await pool!.query("INSERT INTO players(id,game_id,name) VALUES($1,$2,$3)", [
      otherPlayer,
      gameId,
      "Other",
    ]);
    const id = randomUUID();
    await createCharacter(pool!, gameId, playerId, id, "Race");
    expect(await getCharacter(pool!, gameId, otherPlayer, id)).toBeNull();
    const unchanged = await updateCharacter(pool!, gameId, playerId, id, 0, { name: "Race" });
    expect(unchanged.revision).toBe(0);
    const results = await Promise.allSettled([
      updateCharacter(pool!, gameId, playerId, id, 0, { theme: "A" }),
      updateCharacter(pool!, gameId, playerId, id, 0, { theme: "B" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          (result.reason as { code?: string }).code === "stale_revision",
      ),
    ).toHaveLength(1);
  });
});
