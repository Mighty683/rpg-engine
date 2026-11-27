import { tr } from "../../shared/i18n";
/**
 * Client mirror of the server-canonical game note document handling. The
 * backend `modules/game-notes/document.ts` is the single canonical authority;
 * this module mirrors only the code point counter, the structural equality
 * helper, the visible-text extraction and the title checks so the editor and
 * save flows agree with the server's normalization decisions. A parity test
 * in `note-document.test.ts` compares both implementations directly.
 */

import type { NoteDocument } from "./types";

/** Server-canonical title bound, counted in Unicode code points after trimming. */
export const noteTitleCodePointLimit = 160;
/** Server-canonical body bound, counted over the visible text excluding the terminal newline. */
export const noteBodyCodePointLimit = 5_000;

export function codePoints(value: string) {
  let count = 0;
  for (const _codePoint of value) count += 1;
  return count;
}

/**
 * Minimal document shape accepted by the helpers: both the canonical saved
 * documents and Quill's own inserts-only `getContents()` Delta satisfy it.
 */
export type NoteOpsSource = { ops: ReadonlyArray<Record<string, unknown>> };

/** Structurally valid empty body document, matching the server's canonical empty note. */
export function noteDocument(text = ""): NoteDocument {
  return { ops: [{ insert: `${text}\n` }] };
}

/** Concatenated visible text of all inserts, excluding the terminal newline. */
export function visibleNoteText(document: NoteOpsSource) {
  const raw = document.ops.map((op) => (typeof op.insert === "string" ? op.insert : "")).join("");
  return raw.endsWith("\n") ? raw.slice(0, -1) : raw;
}

/** Postgres text and jsonb storage cannot hold NUL; lone surrogates cannot round-trip. */
function isStorableText(value: string) {
  return value.isWellFormed() && !value.includes("\0");
}

/** Deterministic, key-order-free serialization for structural comparison. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : entry,
  );
}

/** Structural document equality under the server's canonical normalization. */
export function sameNoteDocument(a: NoteOpsSource, b: NoteOpsSource) {
  return canonicalJson(a.ops) === canonicalJson(b.ops);
}

/**
 * Title issue message for a trimmed title, mirroring the server's rejection
 * wording so a client-side guard and a 422 response say the same thing.
 */
export function noteTitleIssue(trimmedTitle: string) {
  if (!trimmedTitle) return tr("ui.enterATitleOf1To160Characters");
  if (codePoints(trimmedTitle) > noteTitleCodePointLimit)
    return tr("ui.use160CharactersOrFewerForTheTitle");
  if (!isStorableText(trimmedTitle)) return tr("ui.theTitleContainsUnsupportedCharacters");
  return null;
}
