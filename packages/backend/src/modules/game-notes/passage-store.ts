import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../database/types.ts";
import { transaction } from "../../database/transaction.ts";
import { gameNoteEntries, gameNotePassages } from "./schema.ts";
import type { NoteIndexingEntry, NoteIndexingStore, NotePassageRecord } from "./types.ts";

/**
 * Passage persistence for the game notes semantic index. The store owns the
 * fingerprint gate: a passage set is only written while the entry's current
 * text fingerprint matches the snapshot the passages were generated from,
 * and the whole replacement is one transaction (DELETE + INSERT), so
 * readers never observe a partial set and superseded text is never returned.
 */

const indexedPassagesExist = sql<boolean>`EXISTS (
  SELECT 1 FROM ${gameNotePassages}
  WHERE ${gameNotePassages.gameId} = ${gameNoteEntries.gameId}
    AND ${gameNotePassages.entryId} = ${gameNoteEntries.id}
    AND ${gameNotePassages.textFingerprint} = ${gameNoteEntries.textFingerprint}
)`;

/** Creates the transaction-aware passage store backing the indexing scheduler. */
export function createNotePassageStore(database: Database): NoteIndexingStore {
  async function findEntry(gameId: string, entryId: string): Promise<NoteIndexingEntry | null> {
    const [row] = await database
      .select({
        title: gameNoteEntries.title,
        content: gameNoteEntries.content,
        textFingerprint: gameNoteEntries.textFingerprint,
        indexed: indexedPassagesExist,
      })
      .from(gameNoteEntries)
      .where(and(eq(gameNoteEntries.gameId, gameId), eq(gameNoteEntries.id, entryId)));
    if (!row) return null;
    return { gameId, entryId, ...row, indexed: Boolean(row.indexed) };
  }

  async function replacePassages(
    gameId: string,
    entryId: string,
    textFingerprint: string,
    passages: NotePassageRecord[],
  ) {
    return transaction(database, async (tx) => {
      const [entry] = await tx
        .select({ textFingerprint: gameNoteEntries.textFingerprint })
        .from(gameNoteEntries)
        .where(and(eq(gameNoteEntries.gameId, gameId), eq(gameNoteEntries.id, entryId)));
      if (!entry || entry.textFingerprint !== textFingerprint) return false;
      await tx
        .delete(gameNotePassages)
        .where(and(eq(gameNotePassages.gameId, gameId), eq(gameNotePassages.entryId, entryId)));
      for (const passage of passages) {
        await tx.insert(gameNotePassages).values({
          gameId,
          entryId,
          ordinal: passage.ordinal,
          textFingerprint,
          passageText: passage.text,
          embedding: passage.embedding,
        });
      }
      return true;
    });
  }

  async function findEntriesNeedingIndexing() {
    return database
      .select({ gameId: gameNoteEntries.gameId, entryId: gameNoteEntries.id })
      .from(gameNoteEntries)
      .where(sql`NOT ${indexedPassagesExist}`)
      .orderBy(desc(gameNoteEntries.updatedAt), asc(gameNoteEntries.id));
  }

  return { findEntry, replacePassages, findEntriesNeedingIndexing };
}
