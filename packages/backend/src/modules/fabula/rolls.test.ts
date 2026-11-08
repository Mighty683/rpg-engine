import type { DieSource } from "./types.ts";
import { describe, expect, it } from "vite-plus/test";
import { checkSide, classifyCheck, effectiveDie, genericSide, opposedOutcome, rankOutcome, rollDie, serverDieSource, sideTotal } from "./rolls.ts";
import { defaultSheet } from "./rules.ts";

const fixed = (faces: number[]): DieSource => {
  let index = 0;
  return () => faces[Math.min(index++, faces.length - 1)]!;
};

describe("die source", () => {
  it("server source stays within [1, sides] across many rolls", () => {
    for (let sides = 4; sides <= 20; sides += 2)
      for (let roll = 0; roll < 200; roll++) {
        const face = serverDieSource(sides);
        expect(Number.isInteger(face)).toBe(true);
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(sides);
      }
  });

  it("rolls each die independently", () => {
    const source = fixed([3, 5]);
    expect(rollDie("DEX", 8, source)).toEqual({ label: "DEX", size: 8, face: 3 });
    expect(rollDie("DEX", 8, source)).toEqual({ label: "DEX", size: 8, face: 5 });
  });
});

describe("check classification", () => {
  it.each([
    [1, 1, "fumble"],
    [1, 2, "ordinary"],
    [5, 5, "ordinary"],
    [6, 6, "critical"],
    [12, 12, "critical"],
    [6, 7, "ordinary"],
  ] as const)("classifies %s and %s as %s", (first, second, expected) => {
    expect(classifyCheck(first, second)).toBe(expected);
  });
});

describe("totals", () => {
  it("adds modifiers without 32-bit truncation", () => {
    const dice = [
      { label: "DEX", size: 12, face: 12 },
      { label: "MIG", size: 12, face: 11 },
    ];
    expect(sideTotal(dice, 2147483647)).toBe(23 + 2147483647);
    expect(sideTotal(dice, -2147483648)).toBe(23 - 2147483648);
  });
});

describe("opposed ranking", () => {
  const side = (total: number, result: "fumble" | "critical" | "ordinary") => ({
    dice: [],
    modifier: 0,
    total,
    result,
  });

  it("ranks critical above ordinary above fumble, then compares ordinary totals", () => {
    expect(rankOutcome(side(2, "critical"))).toBeGreaterThan(rankOutcome(side(99, "ordinary")));
    expect(rankOutcome(side(99, "ordinary"))).toBeGreaterThan(rankOutcome(side(100, "fumble")));
    expect(opposedOutcome(side(10, "ordinary"), side(9, "ordinary")).winner).toBe("first");
    expect(opposedOutcome(side(9, "ordinary"), side(10, "ordinary")).winner).toBe("second");
  });

  it("ties two criticals or two fumbles regardless of totals, and ordinary equal totals", () => {
    expect(opposedOutcome(side(12, "critical"), side(20, "critical")).winner).toBe("tie");
    expect(opposedOutcome(side(2, "fumble"), side(2, "fumble")).winner).toBe("tie");
    expect(opposedOutcome(side(10, "ordinary"), side(10, "ordinary")).winner).toBe("tie");
    expect(opposedOutcome(side(2, "fumble"), side(3, "critical")).winner).toBe("second");
  });
});

describe("sides", () => {
  it("classifies two-die checks and leaves generic rolls unclassified", () => {
    const dice: [ReturnType<typeof rollDie>, ReturnType<typeof rollDie>] = [
      { label: "DEX", size: 8, face: 6 },
      { label: "MIG", size: 10, face: 6 },
    ];
    expect(checkSide(dice, 1)).toEqual({ dice, modifier: 1, total: 13, result: "critical" });
    expect(genericSide([dice[0]], 0).result).toBe("none");
  });
});

describe("effective dice", () => {
  it("uses the requested size or the sheet base, rejecting non-standard sizes", () => {
    const base = defaultSheet("Test").baseDice;
    expect(effectiveDie(base, "DEX", 12)).toBe(12);
    expect(effectiveDie(base, "DEX", undefined)).toBe(8);
    expect(() => effectiveDie(base, "DEX", 4)).toThrowError(/die size/i);
  });
});
