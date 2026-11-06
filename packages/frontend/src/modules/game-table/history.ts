// Pure throw-history windowing: merges fetched pages into one ascending, deduplicated
// list and detects when the newest page no longer overlaps the loaded window, so the
// UI resets to the newest window instead of showing a silent gap.
import type { ThrowRecord } from "../../shared/api";

export const historyPageSize = 20;

/** Deduplicates by throw ID and returns entries in ascending sequence order. */
export function mergeThrowPages(pages: readonly ThrowRecord[][]): ThrowRecord[] {
  const byId = new Map<string, ThrowRecord>();
  for (const page of pages)
    for (const entry of page) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

/** The exclusive sequence cursor for fetching the next older page. */
export function olderCursor(throws: readonly ThrowRecord[]): number | null {
  return throws.length ? throws[0]!.seq : null;
}

/**
 * True when the newest page (minSeq..maxSeq) does not touch the rest of the loaded
 * window, meaning older pages no longer connect to what the server would return now.
 */
export function hasWindowGap(throws: readonly ThrowRecord[], newest: readonly ThrowRecord[]): boolean {
  if (!newest.length || throws.length <= newest.length) return false;
  const newestMin = Math.min(...newest.map((entry) => entry.seq));
  const rest = throws.filter((entry) => !newest.some((fresh) => fresh.id === entry.id));
  if (!rest.length) return false;
  const restMax = Math.max(...rest.map((entry) => entry.seq));
  return newestMin > restMax + 1;
}
