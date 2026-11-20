import { createHash } from "node:crypto";
import { compileSchema } from "../../shared/validation/parse.ts";
import { uuidSchema } from "../../shared/validation/schema.ts";
import type { NotePagePosition, NotePageScope } from "./types.ts";

/**
 * Notebook paging cursors are opaque tokens scoped to one game and one
 * trimmed query, carrying the exact keyset position (microsecond-precision
 * updatedAt plus entry ID) of the last entry served on the page. A cursor from
 * another game, another query, or any malformed token is rejected rather than
 * interpreted; nothing in the token grants authority beyond the caller's own
 * accessible notebook position.
 */

const validateEntryId = compileSchema(uuidSchema);
const microsPattern = /^\d{1,17}$/;
const microsCeiling = 9_000_000_000_000_000;

/** Both sides of paging normalize the query the same way before scoping. */
export function noteQueryHash(q: string | null) {
  return createHash("sha256")
    .update(q ?? "", "utf8")
    .digest("hex");
}

type CursorPayload = { g: string; q: string; m: string; i: string };

function positionOf(payload: CursorPayload): NotePagePosition | null {
  if (!validateEntryId(payload.i) || !microsPattern.test(payload.m)) return null;
  if (BigInt(payload.m) > BigInt(microsCeiling)) return null;
  return { id: payload.i, micros: payload.m };
}

export function decodeNotePageCursor(token: string, scope: NotePageScope): NotePagePosition | null {
  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as CursorPayload;
  } catch {
    return null;
  }
  const keys = Object.keys(payload).sort();
  if (
    keys.length !== 4 ||
    !keys.every((key) => ["g", "i", "m", "q"].includes(key)) ||
    typeof payload.g !== "string" ||
    typeof payload.q !== "string" ||
    typeof payload.m !== "string" ||
    typeof payload.i !== "string"
  )
    return null;
  if (payload.g !== scope.gameId || payload.q !== scope.queryHash) return null;
  return positionOf(payload);
}

export function encodeNotePageCursor(position: NotePagePosition, scope: NotePageScope) {
  const payload: CursorPayload = {
    g: scope.gameId,
    q: scope.queryHash,
    m: position.micros,
    i: position.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
