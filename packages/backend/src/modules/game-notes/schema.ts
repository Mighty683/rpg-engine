import {
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { games } from "../../database/schema.ts";
import { noteEmbeddingDimensions } from "./passages.ts";
import type { NoteDocument } from "./types.ts";

/**
 * Game note entries are co-owned by their game: the primary key is
 * (game_id, id), so client-generated entry IDs only have to be unique within
 * one game. Migrations remain the source of truth for constraints and indexes.
 */
export const gameNoteEntries = pgTable("game_note_entries", {
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  id: uuid("id").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").$type<NoteDocument>().notNull(),
  textFingerprint: text("text_fingerprint").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One embedded passage per note entry, produced by the in-process indexing
 * scheduler. The set is replaced wholesale (DELETE + INSERT) inside one
 * transaction after rechecking the entry fingerprint, so passages are only
 * readable for the entry text they were generated from: semantic queries
 * require passage text_fingerprint = the entry's current text_fingerprint.
 * Embeddings are NOT NULL because a passage row only exists to carry one —
 * a title-only note still indexes a single passage (of the title input).
 */
export const gameNotePassages = pgTable(
  "game_note_passages",
  {
    gameId: uuid("game_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    textFingerprint: text("text_fingerprint").notNull(),
    passageText: text("passage_text").notNull(),
    embedding: vector("embedding", { dimensions: noteEmbeddingDimensions }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.entryId, table.ordinal] }),
    foreignKey({
      columns: [table.gameId, table.entryId],
      foreignColumns: [gameNoteEntries.gameId, gameNoteEntries.id],
    }).onDelete("cascade"),
  ],
);
