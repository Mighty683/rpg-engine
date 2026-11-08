import type { OutcomeJson, ResolvedSetup, ThrowKind } from "../modules/throws/types.ts";
import { and, eq, isNull, or } from "drizzle-orm";

import {
  bigint,
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  smallint,
  varchar,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// Migrations remain the source of truth for constraints and indexes.
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull(),
  tokenDigest: bytea("token_digest").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signInAttempts = pgTable("sign_in_attempts", {
  identifierDigest: bytea("identifier_digest").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 20 }).notNull(),
  systemId: text("system_id").notNull(),
  gmAccountId: uuid("gm_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey(),
  gameId: uuid("game_id").notNull(),
  accountId: uuid("account_id").notNull(),
  removed: boolean("removed").notNull().default(false),
  name: varchar("name", { length: 20 }).notNull(),
  activeCharacterId: uuid("active_character_id"),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey(),
  gameId: uuid("game_id").notNull(),
  playerId: uuid("player_id"),
  name: varchar("name", { length: 100 }).notNull(),
  gmActive: boolean("gm_active").notNull().default(false),
  theme: varchar("theme", { length: 200 }),
  level: smallint("level").notNull().default(5),
  dexDie: smallint("dex_die").notNull().default(6),
  insDie: smallint("ins_die").notNull().default(6),
  migDie: smallint("mig_die").notNull().default(6),
  wlpDie: smallint("wlp_die").notNull().default(6),
  currentHp: integer("current_hp").notNull().default(6),
  currentMp: integer("current_mp").notNull().default(6),
  currentIp: integer("current_ip").notNull().default(6),
  fabulaPoints: integer("fabula_points").notNull().default(0),
  maxHpOverride: integer("max_hp_override"),
  maxMpOverride: integer("max_mp_override"),
  maxIpOverride: integer("max_ip_override"),
  defenseOverride: integer("defense_override"),
  magicDefenseOverride: integer("magic_defense_override"),
  initiativeOverride: integer("initiative_override"),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey(),
  gameId: uuid("game_id").notNull(),
  kind: text("kind", { enum: ["game", "character"] }).notNull(),
  characterId: uuid("character_id"),
  tokenDigest: bytea("token_digest").notNull(),
  tokenEncrypted: bytea("token_encrypted").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const namedEntryColumns = () => ({
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  notes: varchar("notes", { length: 500 }).notNull(),
  position: smallint("position").notNull(),
});
export const characterClasses = pgTable("character_classes", namedEntryColumns());
export const characterSkills = pgTable("character_skills", namedEntryColumns());
export const characterEquipment = pgTable("character_equipment", {
  ...namedEntryColumns(),
  kind: text("kind").notNull(),
  priceZenit: integer("price_zenit"),
  equipped: boolean("equipped"),
  accuracyAttribute1: text("accuracy_attribute_1"),
  accuracyAttribute2: text("accuracy_attribute_2"),
  accuracyBonus: integer("accuracy_bonus"),
  fixedDefense: integer("fixed_defense"),
  defenseBonus: integer("defense_bonus"),
  magicDefenseBonus: integer("magic_defense_bonus"),
  initiativeModifier: integer("initiative_modifier"),
});

export const equipmentFields = {
  id: characterEquipment.id,
  character_id: characterEquipment.characterId,
  name: characterEquipment.name,
  notes: characterEquipment.notes,
  position: characterEquipment.position,
  kind: characterEquipment.kind,
  price_zenit: characterEquipment.priceZenit,
  equipped: characterEquipment.equipped,
  accuracy_attribute_1: characterEquipment.accuracyAttribute1,
  accuracy_attribute_2: characterEquipment.accuracyAttribute2,
  accuracy_bonus: characterEquipment.accuracyBonus,
  fixed_defense: characterEquipment.fixedDefense,
  defense_bonus: characterEquipment.defenseBonus,
  magic_defense_bonus: characterEquipment.magicDefenseBonus,
  initiative_modifier: characterEquipment.initiativeModifier,
};

export const characterFields = {
  id: characters.id,
  player_id: characters.playerId,
  name: characters.name,
  theme: characters.theme,
  level: characters.level,
  dex_die: characters.dexDie,
  ins_die: characters.insDie,
  mig_die: characters.migDie,
  wlp_die: characters.wlpDie,
  current_hp: characters.currentHp,
  current_mp: characters.currentMp,
  current_ip: characters.currentIp,
  fabula_points: characters.fabulaPoints,
  max_hp_override: characters.maxHpOverride,
  max_mp_override: characters.maxMpOverride,
  max_ip_override: characters.maxIpOverride,
  defense_override: characters.defenseOverride,
  magic_defense_override: characters.magicDefenseOverride,
  initiative_override: characters.initiativeOverride,
  revision: characters.revision,
  created_at: characters.createdAt,
  updated_at: characters.updatedAt,
};

export const throws = pgTable("throws", {
  id: uuid("id").primaryKey(),
  gameId: uuid("game_id").notNull(),
  seq: bigint("seq", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  authorAccountId: uuid("author_account_id").notNull(),
  role: text("role", { enum: ["GM", "Player"] }).notNull(),
  characterId: uuid("character_id"),
  equipmentId: uuid("equipment_id"),
  characterName: text("character_name").notNull(),
  equipmentName: text("equipment_name"),
  kind: text("kind").$type<ThrowKind>().notNull(),
  setup: jsonb("setup").$type<ResolvedSetup>().notNull(),
  outcome: jsonb("outcome").$type<OutcomeJson>().notNull(),
  deleted: boolean("deleted").notNull().default(false),
});

export const throwFields = {
  id: throws.id,
  game_id: throws.gameId,
  seq: throws.seq,
  created_at: throws.createdAt,
  author_account_id: throws.authorAccountId,
  role: throws.role,
  character_id: throws.characterId,
  equipment_id: throws.equipmentId,
  character_name: throws.characterName,
  equipment_name: throws.equipmentName,
  kind: throws.kind,
  setup: throws.setup,
  outcome: throws.outcome,
  deleted: throws.deleted,
};

export const characterCreateRequests = pgTable("character_create_requests", {
  accountId: uuid("account_id").notNull(),
  requestId: uuid("request_id").notNull(),
  gameId: uuid("game_id").notNull(),
  characterId: uuid("character_id").notNull(),
  name: text("name").notNull(),
});

/** The active roster includes GM-active unassigned characters and members' selected characters. */
export function activeCharacterCondition() {
  return or(
    and(isNull(characters.playerId), eq(characters.gmActive, true)),
    eq(players.activeCharacterId, characters.id),
  );
}
