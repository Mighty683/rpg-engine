import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { eq, sql } from "drizzle-orm";
import { databaseFromPool } from "./database/client.ts";
import { accounts, characters, games, players } from "./database/schema.ts";
import { transaction } from "./database/transaction.ts";
import { defaultSheet } from "./modules/fabula/rules.ts";

const demoGameId = "bb351a42-48c8-4c7b-a9ec-a136ef8c7461";
const demoGmId = "e160cba7-18c1-456e-8fd4-c346fc41a1a8";
const demoPlayerId = "329e9c0c-e25b-4e84-8f41-dfa339ef7c57";

if (process.env.NODE_ENV === "production")
  throw new Error("Demo data cannot be seeded in production");
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required; run migrations before seeding");
const password = process.env.DEMO_PASSWORD ?? "demo-password";
if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024)
  throw new Error("DEMO_PASSWORD must be at least 8 characters and at most 1024 bytes");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const message = await transaction(databaseFromPool(pool), async (client) => {
    const db = client;
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('rpg-engine-demo-seed', 0))`,
    );
    const schema = await db.execute<{ ready: boolean }>(sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'games' AND column_name = 'gm_account_id'
      ) AND to_regclass(current_schema() || '.accounts') IS NOT NULL AS ready`);
    if (!schema.rows[0]?.ready)
      throw new Error(
        "The database needs the account and game ownership migrations. Run `pnpm --filter @rpg-engine/backend migrate` against a fresh database before `pnpm seed:demo`. Existing anonymous games cannot be migrated automatically.",
      );
    const [existing] = await db
      .select({ gmAccountId: games.gmAccountId })
      .from(games)
      .where(eq(games.id, demoGameId));
    if (existing) {
      if (existing.gmAccountId !== demoGmId) throw new Error("Demo game ID is already in use");
      return "Demo game already exists; no data was changed.";
    }
    const [gmHash, playerHash] = await Promise.all([argon2.hash(password), argon2.hash(password)]);
    await db.insert(accounts).values([
      { id: demoGmId, username: "demo-gm", passwordHash: gmHash },
      { id: demoPlayerId, username: "demo-player", passwordHash: playerHash },
    ]);
    await db.insert(games).values({
      id: demoGameId,
      name: "The Lantern Road",
      systemId: "fabula-ultima",
      gmAccountId: demoGmId,
    });
    const membershipId = randomUUID();
    await db.insert(players).values({
      id: membershipId,
      gameId: demoGameId,
      accountId: demoPlayerId,
      name: "Demo Player",
    });
    const playerCharacterId = randomUUID();
    for (const character of [
      { id: randomUUID(), name: "Rowan Ash", playerId: null, active: true },
      { id: playerCharacterId, name: "Nera Vale", playerId: membershipId, active: false },
    ]) {
      const sheet = defaultSheet(character.name);
      await db.insert(characters).values({
        id: character.id,
        gameId: demoGameId,
        playerId: character.playerId,
        gmActive: character.active,
        name: sheet.name,
        theme: sheet.theme,
        level: sheet.level,
        dexDie: sheet.baseDice.DEX,
        insDie: sheet.baseDice.INS,
        migDie: sheet.baseDice.MIG,
        wlpDie: sheet.baseDice.WLP,
        currentHp: sheet.resources.hp,
        currentMp: sheet.resources.mp,
        currentIp: sheet.resources.ip,
        fabulaPoints: sheet.resources.fabula,
      });
    }
    await db
      .update(players)
      .set({ activeCharacterId: playerCharacterId, revision: sql`${players.revision}+1` })
      .where(eq(players.id, membershipId));
    return "Demo game created. Accounts: demo-gm and demo-player.";
  });
  console.log(message);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
