import type { ThrowRecord } from "./types";
import { describe, expect, it } from "vite-plus/test";

import { hasWindowGap, mergeThrowPages, olderCursor } from "./history.ts";

const entry = (id: string, seq: number): ThrowRecord => ({
  id,
  seq,
  createdAt: "2026-01-01T00:00:00Z",
  kind: "free",
  role: "GM",
  characterId: null,
  characterName: "GM",
  equipmentId: null,
  equipmentName: null,
  setup: {
    type: "free",
    kind: "free",
    characterId: null,
    equipmentId: null,
    dice: [],
    modifier: 0,
    redDice: [],
    redModifier: 0,
    note: "",
    weaponBonus: null,
    accuracyDice: null,
  },
  outcome: { first: { dice: [], modifier: 0, total: 0, result: "none" } },
  canRemove: true,
});

describe("throw history windowing", () => {
  it("merges pages deduplicated by ID in ascending sequence order", () => {
    const merged = mergeThrowPages([
      [entry("b", 2), entry("c", 3)],
      [entry("a", 1), entry("b", 2)],
      [entry("d", 4)],
    ]);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("derives the exclusive older cursor from the oldest loaded entry", () => {
    expect(olderCursor([entry("a", 5), entry("b", 9)])).toBe(5);
    expect(olderCursor([])).toBeNull();
  });

  it("detects a gap between the newest page and the loaded window", () => {
    const newest = [entry("n20", 20), entry("n21", 21)];
    expect(hasWindowGap([entry("o1", 1), entry("o2", 2), ...newest], newest)).toBe(true);
    expect(hasWindowGap([entry("o19", 19), ...newest], newest)).toBe(false);
    expect(hasWindowGap([...newest], newest)).toBe(false);
    expect(hasWindowGap([], newest)).toBe(false);
  });
});
