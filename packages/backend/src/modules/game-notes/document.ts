import { createHash } from "node:crypto";
import type { NoteAttributes, NoteDocument, NoteInsertOp } from "./types.ts";

/**
 * Server-canonical Quill document handling for game notes: placement rules,
 * normalization, limits, visible text, text fingerprints, and structural
 * comparison. The client mirrors only the code point counter and the structural
 * equality helper; this module is the single canonical authority. The raw JSON
 * shape (nonempty string inserts, attribute allowlist, no retain/delete or
 * embeds) is enforced by the request contract before these functions run.
 */

/** Structurally valid op as handed over after request-boundary validation. */
type NoteInputOp = { insert: string; attributes?: Record<string, unknown> };
export type NoteInputDocument = { ops: NoteInputOp[] };

/** Semantic rejection the HTTP contract maps onto 422 responses. */
type NoteDocumentIssues = { field: "content"; messages: string[] };
export type NoteDocumentResult =
  | { ok: true; document: NoteDocument }
  | { ok: false; issues: NoteDocumentIssues };

export const noteTitleCodePointLimit = 160;
export const noteBodyCodePointLimit = 5000;
/** Compact normalized JSON size cap; the transport cap stays at 96 KiB. */
export const noteDocumentJsonByteLimit = 64 * 1024;

const inlineKeys = ["bold", "italic", "underline", "strike"] as const;
const blockKeys = ["header", "list"] as const;
const placementMessage = "inline_formatting_applies_to_text_headings_and_lists";

/** Postgres text and jsonb storage cannot hold NUL; lone surrogates cannot round-trip. */
function isStorableText(value: string) {
  return value.isWellFormed() && !value.includes("\0");
}

function codePoints(value: string) {
  let count = 0;
  for (const _codePoint of value) count += 1;
  return count;
}

/** Reject titles that are blank or over the limit after trimming. */
export function noteTitleIssue(trimmedTitle: string) {
  if (!trimmedTitle) return "note_title_required";
  if (codePoints(trimmedTitle) > noteTitleCodePointLimit) return "note_title_length";
  if (!isStorableText(trimmedTitle)) return "note_title_encoding";
  return null;
}

type Attributes =
  | { kind: "none" }
  | { kind: "some"; attributes: NoteAttributes }
  | { kind: "unknown" };

function readAttributes(value: Record<string, unknown> | undefined): Attributes {
  if (!value) return { kind: "none" };
  const keys = Object.keys(value).sort();
  if (!keys.length) return { kind: "none" };
  const attributes: Record<string, unknown> = {};
  for (const key of [...inlineKeys, ...blockKeys]) if (key in value) attributes[key] = value[key];
  if (Object.keys(attributes).length !== keys.length) return { kind: "unknown" };
  return { kind: "some", attributes: attributes as NoteAttributes };
}

function attributesEqual(actual: NoteAttributes | undefined, expected: NoteAttributes | undefined) {
  const a = Object.entries(actual ?? {}).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  const b = Object.entries(expected ?? {}).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return (
    a.length === b.length &&
    a.every(([key, entry], index) => b[index]![0] === key && b[index]![1] === entry)
  );
}

/** Concatenated visible text of all inserts, excluding the terminal newline. */
export function visibleNoteText(document: NoteDocument) {
  const raw = document.ops.map((op) => op.insert).join("");
  return raw.endsWith("\n") ? raw.slice(0, -1) : raw;
}

/** SHA-256 of the normalized title and visible body serialized as a JSON array. */
export function noteTextFingerprint(title: string, document: NoteDocument) {
  return createHash("sha256")
    .update(JSON.stringify([title, visibleNoteText(document)]), "utf8")
    .digest("hex");
}

/** Deterministic, key-order-free serialization for structural comparison. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : entry,
  );
}

export function sameNoteDocument(a: NoteDocument, b: NoteDocument) {
  return canonicalJson(a.ops) === canonicalJson(b.ops);
}

/** Placement and storage violations of one structurally valid op, if any. */
function opIssue(op: NoteInputOp, value: NoteAttributes | undefined): string | null {
  if (!isStorableText(op.insert)) return "the_body_contains_unsupported_characters";
  const block = op.insert.endsWith("\n");
  const hasInline = inlineKeys.some((key) => value?.[key]);
  const hasHeader = value?.header !== undefined;
  const hasList = value?.list !== undefined;
  const hasBlock = hasHeader || hasList;
  if ((hasInline && (hasBlock || block)) || (hasBlock && (!block || (hasHeader && hasList))))
    return placementMessage;
  return null;
}

/**
 * Canonicalize a structurally valid document: reject attribute placement and
 * limit violations, drop empty attribute objects, merge adjacent inserts with
 * identical attributes, and require the terminal newline.
 */
export function normalizeNoteDocument(input: NoteInputDocument): NoteDocumentResult {
  const messages: string[] = [];
  const ops: NoteInsertOp[] = [];
  for (const op of input.ops) {
    const attributes = readAttributes(op.attributes);
    const value = attributes.kind === "some" ? attributes.attributes : undefined;
    const issue = attributes.kind === "unknown" ? "unsupported_formatting" : opIssue(op, value);
    if (issue) {
      messages.push(issue);
      break;
    }
    const last = ops.at(-1);
    if (last && attributesEqual(last.attributes, value)) last.insert += op.insert;
    else ops.push(value ? { insert: op.insert, attributes: value } : { insert: op.insert });
  }
  if (!messages.length && !ops.at(-1)?.insert.endsWith("\n"))
    messages.push("the_document_must_end_with_a_newline");
  const document = { ops };
  if (!messages.length && codePoints(visibleNoteText(document)) > noteBodyCodePointLimit)
    messages.push("note_body_length");
  if (
    !messages.length &&
    Buffer.byteLength(canonicalJson(document), "utf8") > noteDocumentJsonByteLimit
  )
    messages.push("the_formatted_document_is_too_large");
  return messages.length
    ? { ok: false, issues: { field: "content", messages } }
    : { ok: true, document };
}

export const canonicalEmptyNoteDocument: NoteDocument = { ops: [{ insert: "\n" }] };
