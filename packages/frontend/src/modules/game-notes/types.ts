/**
 * Game notes module types: the stored Quill document shape, the entry record,
 * and the game-scoped client contract implemented by the HTTP adapter and
 * injected through the ApiServices composition root. The document types mirror
 * the server-canonical normalized format from the backend game-notes module.
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

/** One document insert as stored by the server normalization. */
export type NoteInsertOp = { insert: string; attributes?: NoteAttributes };

/** Canonical, fully-normalized Quill document Delta. */
export type NoteDocument = { ops: NoteInsertOp[] };

export type NoteEntry = {
  id: string;
  title: string;
  content: NoteDocument;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type NotePage = { entries: NoteEntry[]; nextCursor: string | null };

export type NoteEntryChanges = { title?: string; content?: NoteDocument };

export type NewNoteEntry = { id: string; title: string; content: NoteDocument };

export type NoteListQuery = { q?: string; cursor?: string; signal?: AbortSignal };

/**
 * Game-scoped notes client. The production HTTP adapter implements it; write
 * recovery depends on the by-ID read, which is independent of any active
 * list page or search.
 */
export type GameNotesClient = {
  list: (gameId: string, query?: NoteListQuery) => Promise<NotePage>;
  read: (gameId: string, entryId: string, signal?: AbortSignal) => Promise<NoteEntry>;
  create: (gameId: string, entry: NewNoteEntry) => Promise<NoteEntry>;
  update: (
    gameId: string,
    entryId: string,
    input: { expectedRevision: number; changes: NoteEntryChanges },
  ) => Promise<NoteEntry>;
};
