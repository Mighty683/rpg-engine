import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { parseCreateNote, parseNoteListQuery, parseUpdateNote } from "./contract.ts";

const simpleDocument = { ops: [{ insert: "Ferry" }, { insert: "\n" }] };
const baseCreate = { id: randomUUID(), title: "The ferryman's price", content: simpleDocument };

/** Envelope failures surface as 400s, normalized field failures as 422s. */
function rejection(action: () => unknown) {
  try {
    action();
    return undefined;
  } catch (error) {
    return error as { httpCode?: number; response: { error: { fields: Record<string, string> } } };
  }
}

describe("create note parsing", () => {
  it("normalizes the title and the document content", () => {
    expect(
      parseCreateNote({
        ...baseCreate,
        title: "  The ferryman's price  ",
        content: {
          ops: [
            { insert: "Ferry" },
            { insert: "man", attributes: {} },
            { insert: "\n", attributes: { header: 2 } },
            { insert: "corpse\n", attributes: { list: "bullet" } },
            { insert: "ghost\n", attributes: { list: "bullet" } },
            { insert: "Ransom", attributes: { bold: true, strike: true } },
            { insert: "\n" },
          ],
        },
      }),
    ).toEqual({
      id: baseCreate.id,
      title: "The ferryman's price",
      content: {
        ops: [
          { insert: "Ferryman" },
          { insert: "\n", attributes: { header: 2 } },
          { insert: "corpse\nghost\n", attributes: { list: "bullet" } },
          { insert: "Ransom", attributes: { bold: true, strike: true } },
          { insert: "\n" },
        ],
      },
    });
  });

  it.each([
    ["unknown envelope field", { ...baseCreate, systemId: "fabula-ultima" }],
    ["missing title", { id: baseCreate.id, content: simpleDocument }],
    ["missing content", { id: baseCreate.id, title: "Title" }],
    ["wrong id format", { ...baseCreate, id: "not-a-uuid" }],
    ["retained op", { ...baseCreate, content: { ops: [{ retain: 2 }, { insert: "\n" }] } }],
    ["deleted op", { ...baseCreate, content: { ops: [{ delete: 1 }, { insert: "\n" }] } }],
    ["deleted op with insert", { ...baseCreate, content: { ops: [{ insert: "a", delete: 1 }] } }],
    ["unknown op field", { ...baseCreate, content: { ops: [{ insert: "a\n", forged: true }] } }],
    ["embedded insert", { ...baseCreate, content: { ops: [{ insert: { image: "x" } }] } }],
    ["empty insert", { ...baseCreate, content: { ops: [{ insert: "" }, { insert: "\n" }] } }],
    ["numeric insert", { ...baseCreate, content: { ops: [{ insert: 1 }] } }],
    ["empty ops array", { ...baseCreate, content: { ops: [] } }],
    ["missing ops", { ...baseCreate, content: {} }],
    ["array document", { ...baseCreate, content: [simpleDocument] }],
    ["null document", { ...baseCreate, content: null }],
    [
      "unknown attribute",
      {
        ...baseCreate,
        content: { ops: [{ insert: "a", attributes: { color: "red" } }, { insert: "\n" }] },
      },
    ],
    [
      "string attribute value",
      {
        ...baseCreate,
        content: { ops: [{ insert: "a", attributes: { bold: "yes" } }, { insert: "\n" }] },
      },
    ],
    [
      "header above three",
      {
        ...baseCreate,
        content: { ops: [{ insert: "a", attributes: { header: 4 } }, { insert: "\n" }] },
      },
    ],
    [
      "unknown list kind",
      {
        ...baseCreate,
        content: { ops: [{ insert: "a", attributes: { list: "check" } }, { insert: "\n" }] },
      },
    ],
    ["array attributes", { ...baseCreate, content: { ops: [{ insert: "a\n", attributes: [] }] } }],
  ])("rejects %s as an unsupported format", (_name, value) => {
    expect(rejection(() => parseCreateNote(value))?.httpCode).toBe(400);
  });

  it.each([
    ["blank title", { ...baseCreate, title: "   " }],
    ["overlong title", { ...baseCreate, title: "x".repeat(161) }],
    ["terminal newline missing", { ...baseCreate, content: { ops: [{ insert: "text" }] } }],
    [
      "inline attributes on a newline insert",
      { ...baseCreate, content: { ops: [{ insert: "text\n", attributes: { bold: true } }] } },
    ],
    [
      "header and list on one line",
      {
        ...baseCreate,
        content: { ops: [{ insert: "\n", attributes: { header: 1, list: "bullet" } }] },
      },
    ],
    [
      "header on a text insert",
      {
        ...baseCreate,
        content: { ops: [{ insert: "text", attributes: { header: 3 } }, { insert: "\n" }] },
      },
    ],
    [
      "body over 5,000 code points",
      { ...baseCreate, content: { ops: [{ insert: `${"a".repeat(5001)}\n` }] } },
    ],
    [
      "body over 64 KiB normalized",
      {
        ...baseCreate,
        content: {
          ops: Array.from(
            { length: 3000 },
            (_value, index): { insert: string; attributes?: Record<string, unknown> } => ({
              insert: index % 2 ? "1" : "0",
              attributes: index % 2 ? { italic: true } : { bold: true },
            }),
          ).concat({ insert: "\n" }),
        },
      },
    ],
  ])("rejects %s as invalid field values", (_name, value) => {
    expect(rejection(() => parseCreateNote(value))?.httpCode).toBe(422);
  });
});

describe("update note parsing", () => {
  it("accepts title, content, or both and normalizes the same way", () => {
    expect(parseUpdateNote({ expectedRevision: 2, changes: { title: " Retitled " } })).toEqual({
      expectedRevision: 2,
      changes: { title: "Retitled" },
    });
    const content = { ops: [{ insert: "New", attributes: {} }, { insert: "\n" }] };
    expect(parseUpdateNote({ expectedRevision: 3, changes: { content } })).toEqual({
      expectedRevision: 3,
      changes: { content: { ops: [{ insert: "New\n" }] } },
    });
    expect(
      parseUpdateNote({ expectedRevision: 4, changes: { content, title: " Retitled " } }),
    ).toEqual({
      expectedRevision: 4,
      changes: { title: "Retitled", content: { ops: [{ insert: "New\n" }] } },
    });
  });

  it.each([
    ["missing expected revision", { changes: { title: "Retitled" } }],
    ["wrong revision type", { expectedRevision: "2", changes: { title: "Retitled" } }],
    ["negative revision", { expectedRevision: -1, changes: { title: "Retitled" } }],
    ["empty changes", { expectedRevision: 2, changes: {} }],
    ["unknown change field", { expectedRevision: 2, changes: { heading: "x" } }],
    ["unknown envelope field", { expectedRevision: 2, changes: { title: "x" }, actor: "gm" }],
    ["absent changes", { expectedRevision: 2 }],
    [
      "structurally invalid content",
      { expectedRevision: 2, changes: { content: { ops: [{ insert: 12 }] } } },
    ],
  ])("rejects %s as a malformed envelope", (_name, value) => {
    expect(rejection(() => parseUpdateNote(value))?.httpCode).toBe(400);
  });

  it("reports every invalid field in one 422 response", () => {
    const error = rejection(() =>
      parseUpdateNote({
        expectedRevision: 2,
        changes: { title: "x".repeat(200), content: { ops: [{ insert: "text" }] } },
      }),
    );
    expect(error?.httpCode).toBe(422);
    expect(Object.keys(error?.response.error.fields ?? {}).sort()).toEqual(["content", "title"]);
  });
});

describe("note list query parsing", () => {
  it("trims blank queries into browsing all entries", () => {
    expect(parseNoteListQuery({})).toEqual({ q: null, cursor: null });
    expect(parseNoteListQuery({ q: "  " })).toEqual({ q: null, cursor: null });
    expect(parseNoteListQuery({ q: " sigil " })).toEqual({ q: "sigil", cursor: null });
    expect(parseNoteListQuery({ cursor: "" })).toEqual({ q: null, cursor: null });
  });

  it.each([
    ["array query", { q: ["sigil"] }],
    ["object cursor", { cursor: { forged: 1 } }],
  ])("rejects a %s", (_name, value) => {
    expect(rejection(() => parseNoteListQuery(value))?.httpCode).toBe(400);
  });
});
