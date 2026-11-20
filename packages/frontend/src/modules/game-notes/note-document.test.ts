import { describe, expect, it } from "vite-plus/test";
import {
  normalizeNoteDocument,
  noteBodyCodePointLimit as serverBodyLimit,
  noteTitleIssue as serverTitleIssue,
  sameNoteDocument as serverSameDocument,
  visibleNoteText as serverVisibleText,
} from "../../../../backend/src/modules/game-notes/document.ts";
import {
  codePoints,
  noteBodyCodePointLimit,
  noteDocument,
  noteTitleCodePointLimit,
  noteTitleIssue,
  sameNoteDocument,
  visibleNoteText,
} from "./note-document";
import type { NoteDocument } from "./types";

/**
 * Parity coverage: the production frontend helpers must agree with the
 * server-canonical document handling in the backend game-notes module.
 * The corpus below reuses the backend normalization fixtures, including
 * attribute key order and merge decisions the structural equality relies on.
 */
const corpus: NoteDocument[] = [
  noteDocument(),
  noteDocument("plain line"),
  { ops: [{ insert: "Title", attributes: { bold: true, italic: true } }, { insert: "\n" }] },
  { ops: [{ insert: "Heading\n", attributes: { header: 2 } }] },
  { ops: [{ insert: " one\n", attributes: { list: "bullet" } }, { insert: "two\n" }] },
  {
    ops: [
      { insert: "Ferryman", attributes: {} },
      { insert: " deal\n" },
      { insert: "bold", attributes: { bold: true } },
      { insert: " and strike\n", attributes: { strike: true } },
    ],
  },
  {
    ops: [
      { insert: "Title" },
      { insert: "\n", attributes: { header: 1 } },
      { insert: " item one\n", attributes: { list: "ordered" } },
      { insert: "item two\n", attributes: { list: "ordered" } },
    ],
  },
];

const keyOrderVariantOf = (document: NoteDocument): NoteDocument => ({
  ops: document.ops.map((op) =>
    op.attributes
      ? { ...op, attributes: Object.fromEntries(Object.entries(op.attributes).reverse()) }
      : op,
  ),
});

describe("game note document parity with the backend", () => {
  it("extracts the same visible text as the server for every corpus document", () => {
    for (const document of corpus) {
      expect(visibleNoteText(document)).toBe(serverVisibleText(document));
      expect(keyOrderVariantOf(document)).toEqual(document);
    }
  });

  it("agrees with the server's structural equality, including attribute key order", () => {
    for (const left of corpus) {
      for (const right of corpus) {
        expect(sameNoteDocument(left, right)).toBe(serverSameDocument(left, right));
      }
      expect(sameNoteDocument(left, keyOrderVariantOf(left))).toBe(
        serverSameDocument(left, keyOrderVariantOf(left)),
      );
      expect(sameNoteDocument(left, keyOrderVariantOf(left))).toBe(true);
    }
  });

  it("mirrors the title limit and rejection wording in code points", () => {
    const titles = [
      "",
      "The ferryman's price",
      "🌊".repeat(160),
      "🌊".repeat(161),
      "a".repeat(160),
      "a".repeat(161),
    ];
    for (const title of titles) {
      expect(noteTitleIssue(title)).toBe(serverTitleIssue(title));
      expect(codePoints(title)).toBe(Array.from(title).length);
    }
    expect(noteTitleCodePointLimit).toBe(160);
  });

  it("mirrors the body code point limit at the acceptance boundary", () => {
    const atLimit = normalizeNoteDocument({ ops: [{ insert: "🌊".repeat(5000) + "\n" }] });
    const overLimit = normalizeNoteDocument({ ops: [{ insert: "🌊".repeat(5001) + "\n" }] });
    expect(atLimit.ok).toBe(true);
    expect(overLimit.ok).toBe(false);
    expect(noteBodyCodePointLimit).toBe(serverBodyLimit);
    expect(codePoints(visibleNoteText({ ops: [{ insert: "🌊".repeat(5000) + "\n" }] }))).toBe(5000);
  });

  it("builds the canonical empty document the server accepts", () => {
    expect(normalizeNoteDocument(noteDocument())).toEqual({ ok: true, document: noteDocument() });
    expect(normalizeNoteDocument(noteDocument("saved"))).toEqual({
      ok: true,
      document: { ops: [{ insert: "saved\n" }] },
    });
  });
});
