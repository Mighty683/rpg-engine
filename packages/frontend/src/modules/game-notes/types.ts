import type { ApiSchema } from "@rpg-engine/api-schema";
/**
 * Game notes module types: the stored Quill document shape, the entry record,
 * and the game-scoped client contract implemented by the HTTP adapter and
 * injected through the ApiServices composition root. The document types mirror
 * the server-canonical normalized format from the backend game-notes module.
 */

export type NoteAttributes = NonNullable<ApiSchema["NoteInsert"]["attributes"]>;

/** Canonical, fully-normalized Quill document Delta. */
export type NoteDocument = ApiSchema["NoteContent"];

export type NoteEntry = ApiSchema["NoteEntry"];

export type NotePage = ApiSchema["NotePage"];

export type NoteEntryChanges = ApiSchema["UpdateNote"]["changes"];

type NewNoteEntry = ApiSchema["CreateNote"];

type NoteListQuery = { q?: string; cursor?: string; signal?: AbortSignal };

/**
 * Game-scoped notes client. The production HTTP adapter implements it; write
 * recovery depends on the by-ID read, which is independent of any active
 * list page or search.
 */
export type GameNotesClient = {
  list: (gameId: string, query?: NoteListQuery) => Promise<NotePage>;
  read: (gameId: string, entryId: string, signal?: AbortSignal) => Promise<NoteEntry>;
  create: (gameId: string, entry: NewNoteEntry) => Promise<NoteEntry>;
  update: (gameId: string, entryId: string, input: ApiSchema["UpdateNote"]) => Promise<NoteEntry>;
};
