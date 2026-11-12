import type { ThrowRecord } from "./types";

export const historyPageSize = 20;

/** Pages arrive newest first, with entries in chronological order. */
export function mergeThrowPages(pages: readonly ThrowRecord[][]): ThrowRecord[] {
  const seen = new Set<string>();
  return [...pages]
    .reverse()
    .flat()
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
}

export function olderCursor(throws: readonly ThrowRecord[]): string | null {
  return throws[0]?.id ?? null;
}
