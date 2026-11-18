import type { NoteDocument } from "./types";

export const noteTextLimit = 5_000;

export function noteDocument(text = ""): NoteDocument {
  return { ops: [{ insert: `${text}\n` }] };
}

export function visibleNoteText(document: NoteDocument) {
  return document.ops
    .map(({ insert }) => (typeof insert === "string" ? insert : ""))
    .join("")
    .replace(/\n$/, "");
}

export function sameNoteDocument(left: NoteDocument, right: NoteDocument) {
  return JSON.stringify(left) === JSON.stringify(right);
}
