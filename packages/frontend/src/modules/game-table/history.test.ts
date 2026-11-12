import type { ThrowRecord } from "./types";
import { describe, expect, it } from "vite-plus/test";

import { mergeThrowPages, olderCursor } from "./history.ts";

const entry = (id: string, _seq: number): ThrowRecord => ({
  id,
  private: false,
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
      [entry("b", 2), entry("c", 3), entry("d", 4)],
      [entry("a", 1)],
    ]);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("derives the exclusive older cursor from the oldest loaded entry", () => {
    expect(olderCursor([entry("a", 5), entry("b", 9)])).toBe("a");
    expect(olderCursor([])).toBeNull();
  });
});
