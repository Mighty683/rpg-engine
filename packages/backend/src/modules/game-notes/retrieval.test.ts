import { describe, expect, it } from "vite-plus/test";
import {
  noteSearchDefaultMatchLimit,
  noteSearchMaxMatchLimit,
  noteSearchQueryLimit,
  parseNoteReadInput,
  parseNoteSearchInput,
  vectorLiteral,
} from "./retrieval.ts";

const entryId = "8d174196-5204-4b19-901b-2f2f09a91ead";

describe("agent note tool input validation", () => {
  it("trims queries and bounds them to 1–512 code points with limits 1–10 and a default of 5", () => {
    expect(parseNoteSearchInput({ query: "  how do we cross the river  " })).toEqual({
      text: "how do we cross the river",
      limit: 5,
    });
    expect(parseNoteSearchInput({ query: "river", limit: noteSearchMaxMatchLimit })).toEqual({
      text: "river",
      limit: noteSearchMaxMatchLimit,
    });
    expect(parseNoteSearchInput({ query: "\u{1F600}".repeat(513) })).toBeNull();
    expect(parseNoteSearchInput({ query: "x".repeat(noteSearchQueryLimit) })).toEqual({
      text: "x".repeat(noteSearchQueryLimit),
      limit: noteSearchDefaultMatchLimit,
    });
    expect(parseNoteSearchInput({ query: "  " })).toBeNull();
    expect(parseNoteSearchInput({ query: "" })).toBeNull();
    expect(parseNoteSearchInput({ limit: 3 })).toBeNull();
    expect(parseNoteSearchInput({ query: "x", limit: 0 })).toBeNull();
    expect(parseNoteSearchInput({ query: "x", limit: 11 })).toBeNull();
    expect(parseNoteSearchInput({ query: "x", limit: 2.5 })).toBeNull();
    expect(parseNoteSearchInput({ query: "x", limit: "5" })).toBeNull();
  });

  it("accepts only 1–3 unique UUID entry IDs in request order", () => {
    expect(parseNoteReadInput({ entryIds: [entryId] })).toEqual({ entryIds: [entryId] });
    expect(parseNoteReadInput({ entryIds: [] })).toBeNull();
    expect(parseNoteReadInput({ entryIds: [entryId, entryId] })).toBeNull();
    expect(parseNoteReadInput({ entryIds: [entryId, "not-a-uuid"] })).toBeNull();
    expect(parseNoteReadInput({ entryIds: [entryId, undefined] })).toBeNull();
    expect(parseNoteReadInput({ entryIds: [entryId, entryId, entryId, entryId] })).toBeNull();
    expect(parseNoteReadInput({ entryIds: entryId })).toBeNull();
    expect(parseNoteReadInput({})).toBeNull();
  });

  it("serializes vectors to pgvector text input", () => {
    expect(vectorLiteral([0.5, -0.25, 1])).toBe("[0.5,-0.25,1]");
    expect(vectorLiteral([])).toBe("[]");
  });
});
