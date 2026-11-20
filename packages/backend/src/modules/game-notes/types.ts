import type { Database } from "../../database/types.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";

/**
 * Game notes are the GM's private per-game notebook: full Quill document Deltas
 * with a server-canonical normalization, revisioned saves with optimistic
 * concurrency, and a text fingerprint that only tracks visible text changes
 * (semantic indexing keys off it). Players never read or write notes, and note
 * payloads stay out of events, projections, and logs.
 */

/** Inline formatting applied to text runs. Value is always the literal `true`. */
export type NoteInlineAttributes = {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
};

/** Block formatting applied to the line ending at the op's terminal newline. */
export type NoteBlockAttributes = {
  header?: 1 | 2 | 3;
  list?: "bullet" | "ordered";
};

export type NoteAttributes = NoteInlineAttributes & NoteBlockAttributes;

/** One document insert. Attribute placement is validated during normalization. */
export type NoteInsertOp = { insert: string; attributes?: NoteAttributes };

/** Canonical, fully-normalized Quill document Delta as stored in the database. */
export type NoteDocument = { ops: NoteInsertOp[] };

export type GameNoteEntryRecord = {
  id: string;
  title: string;
  content: NoteDocument;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type GameNotePage = {
  entries: GameNoteEntryRecord[];
  nextCursor: string | null;
};

/** Opaque cursor scope: paging is bound to one game and one trimmed query. */
export type NotePageScope = { gameId: string; queryHash: string };

/** Keyset position in the (updatedAt DESC, id ASC) notebook ordering. */
export type NotePagePosition = { micros: string; id: string };

export type CreateGameNoteInput = {
  id: string;
  title: string;
  content: NoteDocument;
};

export type UpdateGameNoteChanges = {
  title?: string;
  content?: NoteDocument;
};

export type UpdateGameNoteInput = {
  expectedRevision: number;
  changes: UpdateGameNoteChanges;
};

export type GameNotesService = {
  list(
    actor: GameActor,
    gameId: string,
    query: { q: string | null; position: NotePagePosition | null },
  ): Promise<GameNotePage>;
  read(actor: GameActor, gameId: string, entryId: string): Promise<GameNoteEntryRecord>;
  create(
    actor: GameActor,
    gameId: string,
    input: CreateGameNoteInput,
  ): Promise<GameNoteEntryRecord>;
  update(
    actor: GameActor,
    gameId: string,
    entryId: string,
    input: UpdateGameNoteInput,
  ): Promise<GameNoteEntryRecord>;
};

export type GameNotesDependencies = {
  database: Database;
  gameAccessFor: GameAccessFactory;
  /** Notified after commit when a save changes title or visible body text. */
  onTextCommitted?: (gameId: string, entryId: string) => void;
};

/** Embeds note passages and Agent search queries (mistral-embed, 1024 dims). */
export interface NoteEmbeddings {
  embed(inputs: readonly string[], signal?: AbortSignal): Promise<number[][]>;
}

/** Input validated by the tool layer: trimmed query 1–512 chars, limit 1–10. */
export type NoteSearchInput = { text: string; limit: number };

export type NoteSearchMatch = {
  entryId: string;
  title: string;
  /** First ≤600 visible text characters of the entry (or the matched passage). */
  excerpt: string;
  source: "literal" | "semantic";
};

/**
 * Semantic status is computed from the passage fingerprint join, never from
 * in-memory scheduler state: `ready` means every saved entry's current
 * fingerprint has matching passages, `indexing` means at least one is
 * unmatched, and `unavailable` means semantic lookup failed or is disabled.
 */
export type NoteSearchOutcome = { matches: NoteSearchMatch[]; semanticStatus: NoteSemanticStatus };
export type NoteSemanticStatus = "ready" | "indexing" | "unavailable";

export type NoteReadEntry = { entryId: string; title: string; text: string; updatedAt: string };
export type NoteReadOutcome = { entries: NoteReadEntry[]; missingEntryIds: string[] };

/**
 * Agent-facing read-only retrieval over the game's current saved notebook.
 * Both operations recheck current-GM access at execution time through the
 * transaction-bound Game access capability.
 */
export interface GameNotesRetrieval {
  search(
    actor: GameActor,
    gameId: string,
    input: NoteSearchInput,
    signal?: AbortSignal,
  ): Promise<NoteSearchOutcome>;
  read(actor: GameActor, gameId: string, entryIds: string[]): Promise<NoteReadOutcome>;
}

export type GameNotesRetrievalDependencies = {
  database: Database;
  gameAccessFor: GameAccessFactory;
  /** Null disables semantic lookup: literal matches survive with `unavailable`. */
  embeddings: NoteEmbeddings | null;
  /** Minimum cosine similarity for a passage to count as a semantic match. */
  similarityCutoff?: number;
};

/** A stored, already-embedded passage of one note entry. */
export type NotePassageRecord = {
  ordinal: number;
  text: string;
  embedding: number[];
};

/** Snapshot of one entry as the indexing scheduler needs it. */
export type NoteIndexingEntry = {
  gameId: string;
  entryId: string;
  title: string;
  content: NoteDocument;
  textFingerprint: string;
  /** Whether passages already exist for the entry's current fingerprint. */
  indexed: boolean;
};

/** Passage persistence for the indexing scheduler, kept behind this port. */
export interface NoteIndexingStore {
  findEntry(gameId: string, entryId: string): Promise<NoteIndexingEntry | null>;
  /**
   * Atomically replaces the entry's passage set after rechecking that the
   * entry's text fingerprint is still the given one; returns false when the
   * results are superseded and must be discarded.
   */
  replacePassages(
    gameId: string,
    entryId: string,
    textFingerprint: string,
    passages: NotePassageRecord[],
  ): Promise<boolean>;
  /** Games with entries whose current fingerprint has no matching passages. */
  findEntriesNeedingIndexing(): Promise<{ gameId: string; entryId: string }[]>;
}

/**
 * Single-process, in-memory indexing scheduler: only text-changing saves
 * (re)start a 60-second per-note cooldown, already-indexed fingerprints skip
 * embedding, and a failed run retries a bounded number of times before
 * waiting for the next save or restart. The startup sweep — the backfill for
 * notes saved before semantic indexing shipped — runs once per process.
 */
export interface NoteIndexingScheduler {
  /** (Re)starts the per-note cooldown after a committed text-changing save. */
  schedule(gameId: string, entryId: string): void;
  /** Schedules indexing immediately for every entry with stale passages. */
  sweep(): Promise<void>;
  dispose(): void;
}

export type NoteIndexingSchedulerDependencies = {
  store: NoteIndexingStore;
  embeddings: NoteEmbeddings;
  cooldownMs?: number;
  maxAttempts?: number;
};
