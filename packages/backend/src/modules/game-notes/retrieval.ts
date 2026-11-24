import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../../database/types.ts";
import { transaction } from "../../database/transaction.ts";
import { compileSchema } from "../../shared/validation/parse.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import type { GameActor, GameAccessFactory } from "../games/types.ts";
import { visibleNoteText } from "./document.ts";
import { noteEmbeddingDimensions } from "./passages.ts";
import { gameNoteEntries, gameNotePassages } from "./schema.ts";
import { matchesNoteQuery, noteEntryVisibleBody } from "./service.ts";
import type {
  GameNotesRetrieval,
  GameNotesRetrievalDependencies,
  NoteSearchMatch,
  NoteSearchOutcome,
  NoteReadOutcome,
} from "./types.ts";

/**
 * Agent-facing read-only retrieval over the GM's notebook. Every operation
 * runs in one repeatable-read transaction that rechecks current-GM access at
 * execution time — authorization failures are tool errors, never empty
 * results — and treats retrieved note text as reference data only. Literal
 * lookup matches saved titles and visible body text case-insensitively and
 * works with semantic indexing disabled. Semantic lookup ranks only passages
 * whose text fingerprint equals their entry's current fingerprint (no
 * superseded text) by exact cosine distance, applies the cutoff before
 * ranking and limiting, never fills slots below the cutoff, and deduplicates
 * to one match per entry with literal matches first.
 */

const fail = (code: string) => Object.assign(new Error(code), { code });
const readConfig = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

const noteExcerptChars = 600;
export const noteSearchQueryLimit = 512;
export const noteSearchDefaultMatchLimit = 5;
export const noteSearchMaxMatchLimit = 10;
const noteReadMaxEntries = 3;

/**
 * Minimum cosine similarity for a semantic passage match. mistral-embed
 * vectors are unit-normalized, so this compares against raw cosine
 * similarity. Default 0.7 sits above the ~0.62–0.68 band Mistral's own
 * quickstart reports for short unrelated-but-topical documents and at the
 * edge of its ~0.72 example for a relevant answer, favouring precision: the
 * Agent must cite an unrelated entry never, and literal search always
 * remains available. This default is not calibrated with representative GM
 * questions against live mistral-embed vectors (no MISTRAL_API_KEY in this
 * environment); calibrating and recording the shipped value is an open item
 * of the integrated handover.
 */
export const noteSimilarityCutoff = 0.7;

const validateEntryId = compileSchema(uuidSchema);

/** Tool-layer input contract: trimmed query 1–512 code points, limit 1–10. */
export function parseNoteSearchInput(value: Record<string, unknown>) {
  if (typeof value.query !== "string") return null;
  const text = value.query.trim();
  if (!text || Array.from(text).length > noteSearchQueryLimit) return null;
  const limit = value.limit === undefined ? noteSearchDefaultMatchLimit : (value.limit as number);
  if (!Number.isInteger(limit) || limit < 1 || limit > noteSearchMaxMatchLimit) return null;
  return { text, limit };
}

/** Tool-layer input contract: 1–3 unique UUID entry IDs in request order. */
export function parseNoteReadInput(value: Record<string, unknown>) {
  if (!Array.isArray(value.entryIds)) return null;
  const entryIds = value.entryIds;
  if (entryIds.length < 1 || entryIds.length > noteReadMaxEntries) return null;
  if (entryIds.some((id) => typeof id !== "string" || !validateEntryId(id))) return null;
  if (new Set(entryIds).size !== entryIds.length) return null;
  return { entryIds: entryIds as string[] };
}

/** pgvector text input for one embedding vector. */
export function vectorLiteral(vector: readonly number[]) {
  return `[${vector.join(",")}]`;
}

async function requireGm(
  tx: DatabaseTransaction,
  gameAccessFor: GameAccessFactory,
  actor: GameActor,
  gameId: string,
) {
  const access = await gameAccessFor(tx).gameAccess(actor, gameId);
  if (!access) throw fail("not_found");
  if (access.role !== "GM") throw fail("forbidden");
}

async function literalMatches(
  tx: DatabaseTransaction,
  gameId: string,
  query: string,
  limit: number,
) {
  return (
    await tx
      .select({
        entryId: gameNoteEntries.id,
        title: gameNoteEntries.title,
        excerpt: sql<string>`left(${noteEntryVisibleBody}, ${noteExcerptChars})`,
      })
      .from(gameNoteEntries)
      .where(and(eq(gameNoteEntries.gameId, gameId), matchesNoteQuery(query)))
      .orderBy(desc(gameNoteEntries.updatedAt), asc(gameNoteEntries.id))
      .limit(limit)
  ).map<NoteSearchMatch>((row) => ({ ...row, source: "literal" }));
}

/** Whether any saved entry's current fingerprint lacks matching passages. */
async function somePassagesStale(tx: DatabaseTransaction, gameId: string) {
  const stale = sql<boolean>`EXISTS (
    SELECT 1 FROM ${gameNoteEntries}
    WHERE ${gameNoteEntries.gameId} = ${gameId}
      AND NOT EXISTS (
        SELECT 1 FROM ${gameNotePassages}
        WHERE ${gameNotePassages.gameId} = ${gameNoteEntries.gameId}
          AND ${gameNotePassages.entryId} = ${gameNoteEntries.id}
          AND ${gameNotePassages.textFingerprint} = ${gameNoteEntries.textFingerprint}
      )
  )`;
  const result = await tx.execute<{ stale: boolean }>(sql`SELECT ${stale} AS stale`);
  return Boolean(result.rows[0]?.stale);
}

async function semanticMatches(
  tx: DatabaseTransaction,
  gameId: string,
  queryVector: readonly number[],
  similarityCutoff: number,
  slots: number,
  excluded: Set<string>,
) {
  if (slots < 1) return [];
  const literal = vectorLiteral(queryVector);
  const similarity = sql<number>`1 - (${gameNotePassages.embedding} <=> ${literal}::vector)`;
  const rows = await tx
    .selectDistinctOn([gameNotePassages.entryId], {
      entryId: gameNotePassages.entryId,
      title: gameNoteEntries.title,
      excerpt: sql<string>`left(${gameNotePassages.passageText}, ${noteExcerptChars})`,
      similarity,
    })
    .from(gameNotePassages)
    .innerJoin(
      gameNoteEntries,
      and(
        eq(gameNoteEntries.gameId, gameNotePassages.gameId),
        eq(gameNoteEntries.id, gameNotePassages.entryId),
      ),
    )
    .where(
      and(
        eq(gameNotePassages.gameId, gameId),
        eq(gameNotePassages.textFingerprint, gameNoteEntries.textFingerprint),
        sql`${similarity} >= ${similarityCutoff}`,
      ),
    )
    .orderBy(asc(gameNotePassages.entryId), desc(similarity), asc(gameNotePassages.ordinal));
  return rows
    .filter((row) => !excluded.has(row.entryId))
    .sort((a, b) => b.similarity - a.similarity || (a.entryId < b.entryId ? -1 : 1))
    .slice(0, slots)
    .map<NoteSearchMatch>((row) => ({
      entryId: row.entryId,
      title: row.title,
      excerpt: row.excerpt,
      source: "semantic",
    }));
}

/** Creates the Agent-facing game notes retrieval capability. */
export function createGameNotesRetrieval({
  database,
  gameAccessFor,
  embeddings,
  similarityCutoff = noteSimilarityCutoff,
}: GameNotesRetrievalDependencies): GameNotesRetrieval {
  async function search(
    actor: GameActor,
    gameId: string,
    input: { text: string; limit: number },
    signal?: AbortSignal,
  ): Promise<NoteSearchOutcome> {
    return transaction(
      database,
      async (tx) => {
        await requireGm(tx, gameAccessFor, actor, gameId);
        const literal = await literalMatches(tx, gameId, input.text, input.limit);
        let queryVector: readonly number[] | null = null;
        if (embeddings) {
          try {
            const [vector] = await embeddings.embed([input.text], signal);
            if (vector && vector.length === noteEmbeddingDimensions) queryVector = vector;
          } catch {
            queryVector = null;
          }
        }
        if (!queryVector) {
          const unavailable: NoteSearchOutcome = {
            matches: literal,
            semanticStatus: "unavailable",
          };
          return unavailable;
        }
        const excluded = new Set(literal.map((match) => match.entryId));
        const semantic = await semanticMatches(
          tx,
          gameId,
          queryVector,
          similarityCutoff,
          input.limit - literal.length,
          excluded,
        );
        const indexing = await somePassagesStale(tx, gameId);
        const outcome: NoteSearchOutcome = {
          matches: [...literal, ...semantic],
          semanticStatus: indexing ? "indexing" : "ready",
        };
        return outcome;
      },
      readConfig,
    );
  }

  async function read(
    actor: GameActor,
    gameId: string,
    entryIds: string[],
  ): Promise<NoteReadOutcome> {
    return transaction(
      database,
      async (tx) => {
        await requireGm(tx, gameAccessFor, actor, gameId);
        if (!entryIds.length) return { entries: [], missingEntryIds: [] };
        const rows = await tx
          .select({
            id: gameNoteEntries.id,
            title: gameNoteEntries.title,
            content: gameNoteEntries.content,
            updatedAt: gameNoteEntries.updatedAt,
          })
          .from(gameNoteEntries)
          .where(and(eq(gameNoteEntries.gameId, gameId), inArray(gameNoteEntries.id, entryIds)));
        const byId = new Map(rows.map((row) => [row.id, row]));
        const entries: NoteReadOutcome["entries"] = [];
        const missing: string[] = [];
        for (const entryId of entryIds) {
          const row = byId.get(entryId);
          if (!row) {
            missing.push(entryId);
            continue;
          }
          entries.push({
            entryId,
            title: row.title,
            text: visibleNoteText(row.content),
            updatedAt: row.updatedAt.toISOString(),
          });
        }
        return { entries, missingEntryIds: missing };
      },
      readConfig,
    );
  }

  return { search, read };
}
