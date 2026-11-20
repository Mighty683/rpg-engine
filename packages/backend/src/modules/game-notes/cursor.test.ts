import { describe, expect, it } from "vite-plus/test";
import { decodeNotePageCursor, encodeNotePageCursor, noteQueryHash } from "./cursor.ts";

const id = "12345678-1234-4123-8123-123456789abc";
const scope = { gameId: "abcdefab-cdef-4cde-8cde-abcdefabcdef", queryHash: noteQueryHash("sigil") };
const position = { id, micros: "1732123456789012" };

describe("note paging cursors", () => {
  it("round-trips a keyset position through the same scope", () => {
    const token = encodeNotePageCursor(position, scope);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeNotePageCursor(token, scope)).toEqual(position);
  });

  it("rejects cursors from another scope or query", () => {
    const token = encodeNotePageCursor(position, scope);
    expect(
      decodeNotePageCursor(token, {
        gameId: "0f0e0d0c-0b0a-40a0-80a0-0f0e0d0c0b0a",
        queryHash: scope.queryHash,
      }),
    ).toBeNull();
    expect(
      decodeNotePageCursor(token, { gameId: scope.gameId, queryHash: noteQueryHash("ferryman") }),
    ).toBeNull();
  });

  it.each([
    ["garbage", "not-a-cursor"],
    ["non-JSON base64url", Buffer.from("hello", "utf8").toString("base64url")],
    [
      "missing field",
      Buffer.from(JSON.stringify({ g: scope.gameId, q: scope.queryHash, i: id }), "utf8").toString(
        "base64url",
      ),
    ],
    [
      "extra field",
      Buffer.from(
        JSON.stringify({ ...position, g: scope.gameId, q: scope.queryHash, extra: 1 }),
        "utf8",
      ).toString("base64url"),
    ],
    [
      "non-uuid entry id",
      Buffer.from(
        JSON.stringify({ g: scope.gameId, q: scope.queryHash, m: "1", i: "nope" }),
        "utf8",
      ).toString("base64url"),
    ],
    [
      "non-numeric position",
      Buffer.from(
        JSON.stringify({ g: scope.gameId, q: scope.queryHash, m: "soon", i: id }),
        "utf8",
      ).toString("base64url"),
    ],
    [
      "absurd position",
      Buffer.from(
        JSON.stringify({ g: scope.gameId, q: scope.queryHash, m: "99999999999999999", i: id }),
        "utf8",
      ).toString("base64url"),
    ],
    [
      "wrong field type",
      Buffer.from(
        JSON.stringify({ g: scope.gameId, q: scope.queryHash, m: 13, i: id }),
        "utf8",
      ).toString("base64url"),
    ],
  ])("rejects a %s cursor", (_name, token) => {
    expect(decodeNotePageCursor(token, scope)).toBeNull();
  });

  it("hashes blank queries identically and different queries differently", () => {
    expect(noteQueryHash(null)).toBe(noteQueryHash(""));
    expect(noteQueryHash("sigil")).not.toBe(noteQueryHash("Sigil"));
    expect(noteQueryHash("sigil")).toHaveLength(64);
  });
});
