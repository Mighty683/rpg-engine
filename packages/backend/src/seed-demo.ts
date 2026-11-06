import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { defaultSheet } from "./modules/fabula/rules.ts";

const demoGameId = "bb351a42-48c8-4c7b-a9ec-a136ef8c7461";
const demoGmId = "e160cba7-18c1-456e-8fd4-c346fc41a1a8";
const demoPlayerId = "329e9c0c-e25b-4e84-8f41-dfa339ef7c57";

if (process.env.NODE_ENV === "production") throw new Error("Demo data cannot be seeded in production");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; run migrations before seeding");
const password = process.env.DEMO_PASSWORD ?? "demo-password";
if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024) {
  throw new Error("DEMO_PASSWORD must be at least 8 characters and at most 1024 bytes");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('rpg-engine-demo-seed', 0))");
  const schema = await client.query<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'games' AND column_name = 'gm_account_id'
     ) AND to_regclass(current_schema() || '.accounts') IS NOT NULL AS ready`,
  );
  if (!schema.rows[0]?.ready) {
    throw new Error(
      "The database needs the account and game ownership migrations. Run `pnpm --filter @rpg-engine/backend migrate` against a fresh database before `pnpm seed:demo`. Existing anonymous games cannot be migrated automatically.",
    );
  }
  const existing = await client.query<{ gm_account_id: string }>(
    "SELECT gm_account_id FROM games WHERE id = $1", [demoGameId],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].gm_account_id !== demoGmId) throw new Error("Demo game ID is already in use");
    await client.query("COMMIT");
    console.log("Demo game already exists; no data was changed.");
  } else {
    const [gmHash, playerHash] = await Promise.all([argon2.hash(password), argon2.hash(password)]);
    await client.query(
      "INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, $3), ($4, $5, $6)",
      [demoGmId, "demo-gm", gmHash, demoPlayerId, "demo-player", playerHash],
    );
    await client.query("INSERT INTO games (id, name, system_id, gm_account_id) VALUES ($1, $2, $3, $4)",
      [demoGameId, "The Lantern Road", "fabula-ultima", demoGmId]);
    const membershipId = randomUUID();
    await client.query("INSERT INTO players (id, game_id, account_id, name) VALUES ($1, $2, $3, $4)",
      [membershipId, demoGameId, demoPlayerId, "Demo Player"]);
    const gmCharacterId = randomUUID();
    const playerCharacterId = randomUUID();
    for (const character of [
      { id: gmCharacterId, name: "Rowan Ash", playerId: null, active: true },
      { id: playerCharacterId, name: "Nera Vale", playerId: membershipId, active: false },
    ]) {
      const sheet = defaultSheet(character.name);
      await client.query(
        `INSERT INTO characters (id, game_id, player_id, gm_active, name, theme, level,
          dex_die, ins_die, mig_die, wlp_die, current_hp, current_mp, current_ip, fabula_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [character.id, demoGameId, character.playerId, character.active, sheet.name, sheet.theme,
          sheet.level, sheet.baseDice.DEX, sheet.baseDice.INS, sheet.baseDice.MIG, sheet.baseDice.WLP,
          sheet.resources.hp, sheet.resources.mp, sheet.resources.ip, sheet.resources.fabula],
      );
    }
    await client.query("UPDATE players SET active_character_id = $2, revision = revision + 1 WHERE id = $1",
      [membershipId, playerCharacterId]);
    await client.query("COMMIT");
    console.log("Demo game created. Accounts: demo-gm and demo-player.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
