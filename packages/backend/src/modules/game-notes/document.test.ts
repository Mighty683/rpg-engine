import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import type { NoteDocument } from "./types.ts";
import {
  canonicalEmptyNoteDocument,
  noteBodyCodePointLimit,
  noteDocumentJsonByteLimit,
  noteTextFingerprint,
  noteTitleCodePointLimit,
  noteTitleIssue,
  normalizeNoteDocument,
  sameNoteDocument,
  visibleNoteText,
} from "./document.ts";

const empty = normalizeNoteDocument({ ops: [{ insert: "\n" }] });
const issues = (value: ReturnType<typeof normalizeNoteDocument>) =>
  value.ok ? [] : value.issues.messages;

describe("note document normalization", () => {
  it("keeps the canonical empty document and trims empty attribute objects", () => {
    expect(empty).toEqual({ ok: true, document: canonicalEmptyNoteDocument });
    expect(
      normalizeNoteDocument({ ops: [{ insert: "text", attributes: {} }, { insert: "\n" }] }),
    ).toEqual({ ok: true, document: { ops: [{ insert: "text\n" }] } });
  });

  it("rejects attribute keys outside the allowlist even before contract validation", () => {
    expect(
      issues(
        normalizeNoteDocument({
          ops: [{ insert: "text", attributes: { color: "red" } }, { insert: "\n" }],
        }),
      ),
    ).toEqual(["unsupported_formatting"]);
  });

  it("merges adjacent inserts with identical attributes and keeps block boundaries separate", () => {
    const document = {
      ops: [
        { insert: "Title" },
        { insert: "\n", attributes: { header: 1 } },
        { insert: "Ferry" },
        { insert: "man", attributes: {} },
        { insert: "\n" },
        { insert: " item one\n", attributes: { list: "bullet" } },
        { insert: "item two\n", attributes: { list: "bullet" } },
      ],
    };
    expect(normalizeNoteDocument(document)).toEqual({
      ok: true,
      document: {
        ops: [
          { insert: "Title" },
          { insert: "\n", attributes: { header: 1 } },
          { insert: "Ferryman\n" },
          { insert: " item one\nitem two\n", attributes: { list: "bullet" } },
        ],
      },
    });
  });

  it("keeps adjacent inline formatting runs separate when attributes differ", () => {
    const document = {
      ops: [
        { insert: "plain ", attributes: { bold: true } },
        { insert: "emphasis", attributes: { italic: true } },
        { insert: " mixed", attributes: { bold: true, italic: true } },
        { insert: "\n" },
      ],
    };
    expect(normalizeNoteDocument(document)).toEqual({ ok: true, document });
  });

  it.each([
    ["inline attributes on a newline insert", [{ insert: "text\n", attributes: { bold: true } }]],
    ["header and list on one line", [{ insert: "\n", attributes: { header: 1, list: "bullet" } }]],
    ["header on a text insert", [{ insert: "text" }, { insert: "!", attributes: { header: 3 } }]],
    [
      "list on a text insert",
      [{ insert: "text", attributes: { list: "ordered" } }, { insert: "\n" }],
    ],
  ])("rejects %s", (_name, ops) => {
    expect(issues(normalizeNoteDocument({ ops: [...ops, { insert: "\n" }] }))).toEqual([
      "inline_formatting_applies_to_text_headings_and_lists",
    ]);
  });

  it("requires the terminal newline and undecodable body characters even after merging", () => {
    expect(issues(normalizeNoteDocument({ ops: [{ insert: "text" }] }))).toEqual([
      "the_document_must_end_with_a_newline",
    ]);
    expect(issues(normalizeNoteDocument({ ops: [{ insert: "a\0b" }, { insert: "\n" }] }))).toEqual([
      "the_body_contains_unsupported_characters",
    ]);
    expect(
      issues(
        normalizeNoteDocument({
          ops: [{ insert: "unpaired \ud800 surrogate" }, { insert: "\n" }],
        }),
      ),
    ).toEqual(["the_body_contains_unsupported_characters"]);
  });

  it("limits the visible body to 5,000 code points excluding the terminal newline", () => {
    const atLimit = { ops: [{ insert: `${"\u{1F600}".repeat(noteBodyCodePointLimit)}\n` }] };
    expect(normalizeNoteDocument(atLimit)).toEqual({ ok: true, document: atLimit });
    const overLimit = {
      ops: [{ insert: `${"a".repeat(noteBodyCodePointLimit)}!\n` }],
    };
    expect(issues(normalizeNoteDocument(overLimit))).toEqual(["note_body_length"]);
    const textWithInteriorNewline = {
      ops: [{ insert: `${"a".repeat(4997)}\n${"x".repeat(2)}` }, { insert: "\n" }],
    };
    expect(normalizeNoteDocument(textWithInteriorNewline).ok).toBe(true);
  });

  it("limits compact normalized JSON to 64 KiB independently of the text budget", () => {
    const ops: { insert: string; attributes?: Record<string, unknown> }[] = Array.from(
      { length: 3000 },
      (_value, index) => ({
        insert: index % 2 ? "1" : "0",
        attributes: index % 2 ? { italic: true } : { bold: true },
      }),
    );
    ops.push({ insert: "\n" });
    expect(issues(normalizeNoteDocument({ ops }))).toEqual(["the_formatted_document_is_too_large"]);
    const small = ops.slice(-1002);
    expect(normalizeNoteDocument({ ops: small }).ok).toBe(true);
    expect(noteDocumentJsonByteLimit).toBe(64 * 1024);
  });

  it("keeps titles within the trimmed code point budget", () => {
    expect(noteTitleIssue("")).toBe("note_title_required");
    expect(noteTitleIssue("ok title")).toBeNull();
    expect(noteTitleIssue("\u{1F600}".repeat(noteTitleCodePointLimit))).toBeNull();
    expect(noteTitleIssue(`x${"\u{1F600}".repeat(noteTitleCodePointLimit)}`)).toBe(
      "note_title_length",
    );
    expect(noteTitleIssue("title with \0")).toBe("note_title_encoding");
  });

  it("exposes visible text without the terminal newline only", () => {
    expect(visibleNoteText(canonicalEmptyNoteDocument)).toBe("");
    expect(visibleNoteText({ ops: [{ insert: "one\n" }, { insert: "two\n" }] })).toBe("one\ntwo");
    expect(
      visibleNoteText({ ops: [{ insert: "para\n" }, { insert: "\n", attributes: { header: 1 } }] }),
    ).toBe("para\n");
  });

  it("fingerprints the normalized title and visible body as a JSON array", () => {
    const document: NoteDocument = {
      ops: [{ insert: "Ferry", attributes: { bold: true } }, { insert: "man\n" }],
    };
    const expected = createHash("sha256")
      .update(JSON.stringify(["The ferryman's price", "Ferryman"]), "utf8")
      .digest("hex");
    expect(noteTextFingerprint("The ferryman's price", document)).toBe(expected);
    expect(noteTextFingerprint("Other title", document)).not.toBe(expected);
  });

  it("compares normalized documents structurally regardless of attribute key order", () => {
    expect(
      sameNoteDocument(
        { ops: [{ insert: "text", attributes: { bold: true, italic: true } }, { insert: "\n" }] },
        { ops: [{ insert: "text", attributes: { italic: true, bold: true } }, { insert: "\n" }] },
      ),
    ).toBe(true);
    expect(
      sameNoteDocument({ ops: [{ insert: "text\n" }] }, { ops: [{ insert: "texts\n" }] }),
    ).toBe(false);
    expect(
      sameNoteDocument(
        { ops: [{ insert: "text\n" }] },
        { ops: [{ insert: "text", attributes: { bold: true } }, { insert: "\n" }] },
      ),
    ).toBe(false);
  });
});
