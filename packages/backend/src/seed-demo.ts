import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { eq, sql } from "drizzle-orm";
import { databaseFromPool } from "./database/client.ts";
import {
  accounts,
  characterClassLevels,
  characterSkillRanks,
  characters,
  classTemplates,
  gameClasses,
  gameClassSkills,
  games,
  npcAttacks,
  npcs,
  players,
} from "./database/schema.ts";
import { transaction } from "./database/transaction.ts";
import type { DatabaseTransaction } from "./database/types.ts";
import { applyMigrations } from "./migrations.ts";
import type { ClassDefinition } from "./modules/class-catalog/types.ts";
import { defaultSheet } from "./modules/fabula/rules.ts";

const demoGameId = "bb351a42-48c8-4c7b-a9ec-a136ef8c7461";
const demoGmId = "e160cba7-18c1-456e-8fd4-c346fc41a1a8";
const demoPlayerId = "329e9c0c-e25b-4e84-8f41-dfa339ef7c57";

async function seedDemoClass(db: DatabaseTransaction, characterId: string) {
  const definition: ClassDefinition = {
    name: "Lantern Guard",
    description: "Protects travelers along the Lantern Road.",
    freeBenefits: [
      { id: randomUUID(), kind: "modifier", name: "Stalwart", stat: "maxHp", amount: 5 },
    ],
    skills: [
      {
        id: randomUUID(),
        name: "Watchful",
        description: "Stay alert while escorting the party.",
        maxRank: 2,
        benefits: [
          { id: randomUUID(), kind: "modifier", name: "Keen Senses", stat: "dieIns", amount: 1 },
        ],
      },
    ],
  };
  await db.insert(classTemplates).values({
    id: randomUUID(),
    accountId: demoGmId,
    systemId: "fabula-ultima",
    definition,
  });

  const gameClassId = randomUUID();
  const { skills, freeBenefits, ...details } = definition;
  await db.insert(gameClasses).values({
    id: gameClassId,
    gameId: demoGameId,
    systemId: "fabula-ultima",
    ...details,
    freeBenefits: freeBenefits.map((benefit) => ({ ...benefit, id: randomUUID() })),
  });
  const skill = skills[0]!;
  const skillId = randomUUID();
  const allocation = { gameId: demoGameId, gameClassId, characterId };
  await db.insert(gameClassSkills).values({
    ...skill,
    id: skillId,
    gameId: demoGameId,
    gameClassId,
    position: 0,
    benefits: skill.benefits.map((benefit) => ({ ...benefit, id: randomUUID() })),
  });
  await db.insert(characterClassLevels).values({ ...allocation, level: 1 });
  await db.insert(characterSkillRanks).values({ ...allocation, skillId, rank: 1 });
  await db
    .update(characters)
    .set({ expCurrent: sql`${characters.expCurrent} - 10` })
    .where(eq(characters.id, characterId));
}

async function resetDemoDatabase(pool: pg.Pool) {
  await transaction(databaseFromPool(pool), async (db) => {
    const { rows } = await db.execute<{ schema: string }>(sql`SELECT current_schema() AS schema`);
    if (rows[0]?.schema !== "public") throw new Error("Reset requires the public schema");
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('public', 0))`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
  });
  await applyMigrations(pool);
}

const args = process.argv.slice(2);
const reset = args.length === 1 && args[0] === "--reset";
if (args.length && !reset) throw new Error("Usage: pnpm seed:demo [--reset]");

if (process.env.NODE_ENV === "production")
  throw new Error("Demo data cannot be seeded in production");
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required; run migrations before seeding");
const password = process.env.DEMO_PASSWORD ?? "demo-password";
if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024)
  throw new Error("DEMO_PASSWORD must be at least 8 characters and at most 1024 bytes");

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
try {
  if (reset) {
    const { host } = new pg.Client({ connectionString });
    if (!["localhost", "127.0.0.1", "::1"].includes(host))
      throw new Error("Reset requires a loopback PostgreSQL host");
    await resetDemoDatabase(pool);
  }
  const message = await transaction(databaseFromPool(pool), async (client) => {
    const db = client;
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('rpg-engine-demo-seed', 0))`,
    );
    const schema = await db.execute<{ ready: boolean }>(sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'games' AND column_name = 'gm_account_id'
      ) AND to_regclass(current_schema() || '.character_skill_ranks') IS NOT NULL AS ready`);
    if (!schema.rows[0]?.ready)
      throw new Error(
        "Run `pnpm --filter @rpg-engine/backend migrate` before seeding, or use `pnpm seed:demo --reset` to rebuild the local schema.",
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
    const gmCharacterId = randomUUID();
    const playerCharacterId = randomUUID();
    for (const character of [
      { id: gmCharacterId, name: "Rowan Ash", playerId: null, active: true },
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
    await seedDemoClass(db, gmCharacterId);

    const npcFixtures = [
      {
        id: randomUUID(),
        name: "Captain Vesper",
        relationship: "enemy" as const,
        visibility: "known" as const,
        level: 20,
        dexDie: 10,
        insDie: 8,
        migDie: 10,
        wlpDie: 8,
        currentHp: 90,
        maxHp: 90,
        currentMp: 40,
        maxMp: 40,
        defense: 10,
        magicDefense: 8,
        notes: "Commands the raiders on the Lantern Road.",
        attack: {
          name: "Saber",
          reach: "melee" as const,
          attribute1: "DEX",
          attribute2: "MIG",
          damageBonus: 10,
          damageType: "physical",
        },
      },
      {
        id: randomUUID(),
        name: "Mira the Guide",
        relationship: "friend" as const,
        visibility: "visible" as const,
        level: 10,
        dexDie: 8,
        insDie: 10,
        migDie: 6,
        wlpDie: 8,
        currentHp: 50,
        maxHp: 50,
        currentMp: 30,
        maxMp: 30,
        defense: 8,
        magicDefense: 9,
        notes: "Knows a safe route through the marsh.",
        attack: {
          name: "Shortbow",
          reach: "ranged" as const,
          attribute1: "DEX",
          attribute2: "INS",
          damageBonus: 6,
          damageType: "physical",
        },
      },
      {
        id: randomUUID(),
        name: "The Masked Patron",
        relationship: "neutral" as const,
        visibility: "hidden" as const,
        level: 15,
        dexDie: 8,
        insDie: 10,
        migDie: 6,
        wlpDie: 10,
        currentHp: 60,
        maxHp: 60,
        currentMp: 50,
        maxMp: 50,
        defense: 8,
        magicDefense: 10,
        notes: "Secretly funds both sides of the conflict.",
        attack: {
          name: "Arcane Bolt",
          reach: "ranged" as const,
          attribute1: "INS",
          attribute2: "WLP",
          damageBonus: 8,
          damageType: "arcane",
        },
      },
    ];
    for (const { attack, ...npc } of npcFixtures) {
      await db.insert(npcs).values({ ...npc, gameId: demoGameId });
      await db
        .insert(npcAttacks)
        .values({ ...attack, id: randomUUID(), npcId: npc.id, position: 0 });
    }
    return "Demo game created. Accounts: demo-gm and demo-player.";
  });
  console.log(message);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
