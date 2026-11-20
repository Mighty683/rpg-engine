import { describe, expect, it } from "vite-plus/test";
import {
  notePassageCodePoints,
  notePassageOverlapCodePoints,
  splitNotePassages,
} from "./passages.ts";
import { canonicalEmptyNoteDocument, visibleNoteText } from "./document.ts";
import type { NoteDocument } from "./types.ts";

const body = (text: string): NoteDocument => ({ ops: [{ insert: `${text}\n` }] });
const note = (first: string, heading: string, tail: string): NoteDocument => ({
  ops: [
    { insert: `${first}\n` },
    { insert: `${heading}\n`, attributes: { header: 2 } },
    { insert: `${tail}\n` },
  ],
});

describe("note passage splitting", () => {
  it("indexes a title-only note as one empty passage embedding the title alone", () => {
    expect(splitNotePassages("Compass cache", canonicalEmptyNoteDocument)).toEqual([
      { ordinal: 0, text: "", embeddingInput: "Compass cache" },
    ]);
  });

  it("keeps a note within the passage budget as one passage with the title included", () => {
    expect(splitNotePassages("Title", body("one line of text"))).toEqual([
      { ordinal: 0, text: "one line of text", embeddingInput: "Title\n\none line of text" },
    ]);
    expect(splitNotePassages("T", note("intro", "Heading", "tail"))).toEqual([
      { ordinal: 0, text: "intro\nHeading\ntail", embeddingInput: "T\n\nintro\nHeading\ntail" },
    ]);
    expect(splitNotePassages("Title", body("x".repeat(notePassageCodePoints)))).toEqual([
      {
        ordinal: 0,
        text: "x".repeat(notePassageCodePoints),
        embeddingInput: `Title\n\n${"x".repeat(notePassageCodePoints)}`,
      },
    ]);
  });

  it("chunks long sections with at most 800 code points and 200 overlap", () => {
    const passages = splitNotePassages("Title", body("x".repeat(850)));
    expect(passages).toEqual([
      { ordinal: 0, text: "x".repeat(800), embeddingInput: `Title\n\n${"x".repeat(800)}` },
      { ordinal: 1, text: "x".repeat(250), embeddingInput: `Title\n\n${"x".repeat(250)}` },
    ]);
    expect(passages[0]!.text.slice(600)).toBe(passages[1]!.text.slice(0, 200));
    expect(notePassageOverlapCodePoints).toBe(200);
  });

  it("counts code points, not UTF-16 units, so astral characters chunk safely", () => {
    const passages = splitNotePassages("Title", body("\u{1F600}".repeat(801)));
    expect(passages).toHaveLength(2);
    expect(passages[0]!.text).toBe("\u{1F600}".repeat(800));
    expect(passages[1]!.text).toBe("\u{1F600}".repeat(201));
  });

  it("never lets a passage cross a heading boundary", () => {
    const tail = "y".repeat(900);
    const document = note("a".repeat(500), "Heading", tail);
    const passages = splitNotePassages("Title", document);
    expect(passages.map((passage) => passage.ordinal)).toEqual([0, 1, 2]);
    expect(passages[0]!.text).toBe(`${"a".repeat(500)}\n`);
    expect(passages[1]!.text).toHaveLength(800);
    expect(passages[1]!.text.startsWith("Heading\n")).toBe(true);
    expect(passages[1]!.text.endsWith("y".repeat(792))).toBe(true);
    expect(passages[2]!.text).toBe(tail.slice(592));
    expect(passages[1]!.text.slice(600)).toBe(tail.slice(592, 792));
    expect(visibleNoteText(document)).toBe(`${"a".repeat(500)}\nHeading\n${tail}`);
  });

  it("keeps list lines inside their section instead of splitting at them", () => {
    const document: NoteDocument = {
      ops: [
        { insert: "intro\n" },
        { insert: "one\ntwo\n", attributes: { list: "bullet" } },
        { insert: "outro\n" },
      ],
    };
    expect(splitNotePassages("T", document)).toEqual([
      { ordinal: 0, text: "intro\none\ntwo\noutro", embeddingInput: "T\n\nintro\none\ntwo\noutro" },
    ]);
  });

  it("keeps a short trailing blank heading line inside the single passage", () => {
    const document: NoteDocument = {
      ops: [{ insert: "intro\n" }, { insert: "\n", attributes: { header: 1 } }, { insert: "\n" }],
    };
    expect(splitNotePassages("T", document)).toEqual([
      { ordinal: 0, text: "intro\n\n", embeddingInput: "T\n\nintro\n\n" },
    ]);
  });
});
