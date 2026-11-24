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
  characterEquipment,
  throws,
  games,
  npcAttacks,
  npcs,
  players,
} from "./database/schema.ts";
import { transaction } from "./database/transaction.ts";
import type { DatabaseTransaction } from "./database/types.ts";
import { applyMigrations } from "./migrations.ts";
import { insertTemplate, insertGameClass } from "./modules/class-catalog/repository.ts";
import { gameNoteEntries } from "./modules/game-notes/schema.ts";
import { noteTextFingerprint } from "./modules/game-notes/document.ts";
import { resolveThrow } from "./modules/throws/resolve.ts";
import type { ThrowSetup } from "./modules/throws/types.ts";
import { serverDieSource } from "./modules/fabula/rolls.ts";
import {
  campaigns,
  demoAccounts,
  demoGameId,
  npcFixtures,
  type Campaign,
} from "./seed-demo-fixtures.ts";
import { defaultSheet } from "./modules/fabula/rules.ts";

async function seedAccounts(db: DatabaseTransaction, password: string) {
  for (const account of demoAccounts) {
    const [existing] = await db
      .select({ username: accounts.username })
      .from(accounts)
      .where(eq(accounts.id, account.id));
    if (existing && existing.username !== account.username)
      throw new Error("Demo account ID is already in use");
    if (!existing)
      await db.insert(accounts).values({ ...account, passwordHash: await argon2.hash(password) });
  }
}

async function seedCharacter(
  db: DatabaseTransaction,
  gameId: string,
  name: string,
  playerId: string | null,
) {
  const sheet = defaultSheet(name);
  const id = randomUUID();
  await db.insert(characters).values({
    id,
    gameId,
    playerId,
    gmActive: !playerId,
    name,
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
  return { id, name, playerId, sheet, currentDice: sheet.baseDice, revision: 0 };
}

async function seedClass(db: DatabaseTransaction, campaign: Campaign, characterId: string) {
  const makeRecord = () => ({
    id: randomUUID(),
    systemId: "fabula-ultima" as const,
    revision: 0,
    definition: campaign.makeClass(),
  });
  await insertTemplate(db, campaign.gm, makeRecord());
  const record = await insertGameClass(db, campaign.id, makeRecord());
  const allocation = { gameId: campaign.id, gameClassId: record.id, characterId };
  await db.insert(characterClassLevels).values({ ...allocation, level: 1 });
  await db
    .insert(characterSkillRanks)
    .values({ ...allocation, skillId: record.definition.skills[0]!.id, rank: 1 });
  await db
    .update(characters)
    .set({ expCurrent: sql`${characters.expCurrent} - 10` })
    .where(eq(characters.id, characterId));
}

async function seedMember(
  db: DatabaseTransaction,
  campaign: Campaign,
  member: Campaign["members"][number],
  index: number,
) {
  const playerId = randomUUID();
  await db.insert(players).values({
    id: playerId,
    gameId: campaign.id,
    accountId: member.accountId,
    name: member.player,
  });
  const character = await seedCharacter(db, campaign.id, member.character, playerId);
  await db
    .update(players)
    .set({ activeCharacterId: character.id, revision: 1 })
    .where(eq(players.id, playerId));

  const weapon = {
    kind: "weapon" as const,
    id: randomUUID(),
    name: member.weapon,
    notes: "HR + 6 physical damage.",
    accuracyDice: ["DEX", "INS"] as ["DEX", "INS"],
    accuracyBonus: 1,
    equipped: true,
    priceZenit: null,
  };
  await db.insert(characterEquipment).values({
    ...weapon,
    characterId: character.id,
    position: 1,
    accuracyAttribute1: weapon.accuracyDice[0],
    accuracyAttribute2: weapon.accuracyDice[1],
  });
  const context = {
    role: "Player" as const,
    membershipId: playerId,
    ownActiveCharacterId: character.id,
    activeCharacterIds: [character.id],
    character,
    weapon,
    source: null,
  };
  const setups: ThrowSetup[] = [
    {
      type: "attribute",
      characterId: character.id,
      expectedRevision: 0,
      attributes: ["INS", "WLP"],
      dice: {},
      modifier: 0,
      redDice: [],
      redModifier: 0,
      note: campaign.check,
    },
    {
      type: "weapon",
      characterId: character.id,
      expectedRevision: 0,
      equipmentId: weapon.id,
      dice: [character.currentDice.DEX, character.currentDice.INS],
      modifier: 0,
      note: "Sparring before the next watch.",
    },
  ];
  for (const [offset, setup] of setups.entries()) {
    const seq = index * setups.length + offset + 1;
    const roll = resolveThrow({ sourceThrowId: null, setup }, context, serverDieSource);
    await db.insert(throws).values({
      ...roll,
      id: randomUUID(),
      gameId: campaign.id,
      authorAccountId: member.accountId,
      seq,
      createdAt: new Date(
        Date.now() - (campaign.members.length * setups.length - seq + 1) * 60_000,
      ),
    });
  }
}

async function seedCampaign(db: DatabaseTransaction, campaign: Campaign) {
  await db.insert(games).values({
    id: campaign.id,
    name: campaign.name,
    systemId: "fabula-ultima",
    gmAccountId: campaign.gm,
  });
  const gmCharacter = await seedCharacter(db, campaign.id, campaign.gmCharacter, null);
  await seedClass(db, campaign, gmCharacter.id);
  for (const [index, member] of campaign.members.entries())
    await seedMember(db, campaign, member, index);
  for (const [title, body] of campaign.notes) {
    const content = { ops: [{ insert: body + "\n" }] };
    await db.insert(gameNoteEntries).values({
      id: randomUUID(),
      gameId: campaign.id,
      title,
      content,
      textFingerprint: noteTextFingerprint(title, content),
    });
  }
  if (campaign.id === demoGameId) await seedLanternNpcs(db);
}

async function seedLanternNpcs(db: DatabaseTransaction) {
  for (const { attack, ...npc } of npcFixtures) {
    await db.insert(npcs).values({ ...npc, gameId: demoGameId });
    await db.insert(npcAttacks).values({ ...attack, id: randomUUID(), npcId: npc.id, position: 0 });
  }
}

async function resetDemoDatabase(pool: pg.Pool) {
  await transaction(databaseFromPool(pool), async (db) => {
    const { rows } = await db.execute<{ schema: string }>(sql`SELECT current_schema() AS schema`);
    if (rows[0]?.schema !== "public") throw new Error("Reset requires the public schema");
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('public', 0))`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    // Dropping the schema also dropped the pgvector extension installed in it;
    // recreate it here, before migrations, so the passage migration applies.
    // This reset path runs as the schema owner on a loopback host only.
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
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
      ) AND to_regclass(current_schema() || '.game_note_entries') IS NOT NULL AS ready`);
    if (!schema.rows[0]?.ready)
      throw new Error(
        "Run `pnpm --filter @rpg-engine/backend migrate` before seeding, or use `pnpm seed:demo --reset` to rebuild the local schema.",
      );
    await seedAccounts(db, password);
    const created = [];
    for (const campaign of campaigns) {
      const [existing] = await db.select().from(games).where(eq(games.id, campaign.id));
      if (existing && existing.gmAccountId !== campaign.gm)
        throw new Error("Demo game ID is already in use");
      if (existing) continue;
      await seedCampaign(db, campaign);
      created.push(campaign.name);
    }
    return created.length
      ? `Created demo games: ${created.join(", ")}.`
      : "Demo games already exist.";
  });
  console.log(message);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
