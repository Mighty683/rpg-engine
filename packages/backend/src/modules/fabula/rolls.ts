import type { DieSource, RolledDie, CheckResult, SideOutcome, OpposedOutcome, Attribute, Die } from "./types.ts";
// Fabula Ultima dice resolution: pure outcome calculation over rolled faces with an
// injectable die source. Production passes the server's uniform random generator;
// tests pass a seeded or scripted one. See docs/spec/fabula-ultima/checks.md.
import { randomInt } from "node:crypto";

export const standardDice: readonly Die[] = [6, 8, 10, 12];
export const freeDice: readonly number[] = [4, 6, 8, 10, 12, 20];

/** Uniform random die roll in production; always returns an integer in [1, sides]. */
export const serverDieSource: DieSource = (sides) => randomInt(1, sides + 1);

/** Rolls one die of the given size with the supplied die source. */
export function rollDie(label: string | null, size: number, source: DieSource): RolledDie {
  return { label, size, face: source(size) };
}

/** Classifies a two-die Fabula check from faces before modifiers: double 1 fumbles, matching 6+ crits. */
export function classifyCheck(first: number, second: number): CheckResult {
  if (first === 1 && second === 1) return "fumble";
  if (first === second && first >= 6) return "critical";
  return "ordinary";
}

/** Totals never truncate to 32 bits; faces are small and modifiers are signed 32-bit. */
export function sideTotal(dice: readonly RolledDie[], modifier: number): number {
  return dice.reduce((sum, die) => sum + die.face, modifier);
}

export function checkSide(dice: readonly [RolledDie, RolledDie], modifier: number): SideOutcome {
  return {
    dice: [...dice],
    modifier,
    total: sideTotal(dice, modifier),
    result: classifyCheck(dice[0].face, dice[1].face),
  };
}

export function genericSide(dice: readonly RolledDie[], modifier: number): SideOutcome {
  return { dice: [...dice], modifier, total: sideTotal(dice, modifier), result: "none" };
}

/** Fabula opposed ranking: critical above ordinary above fumble; totals break ordinary ties; two crits or two fumbles tie. */
export function rankOutcome(outcome: SideOutcome): number {
  if (outcome.result === "critical") return Number.POSITIVE_INFINITY;
  if (outcome.result === "fumble") return Number.NEGATIVE_INFINITY;
  return outcome.total;
}

export function opposedOutcome(first: SideOutcome, second: SideOutcome): OpposedOutcome {
  const firstRank = rankOutcome(first);
  const secondRank = rankOutcome(second);
  return {
    first,
    second,
    winner: firstRank === secondRank ? "tie" : firstRank > secondRank ? "first" : "second",
  };
}

/** Resolves the effective die size for an attribute, defaulting to the sheet's base die. */
export function effectiveDie(baseDice: Record<Attribute, Die>, attribute: Attribute, requested: number | undefined): Die {
  const size = requested ?? baseDice[attribute];
  if (!standardDice.includes(size as Die)) throw Object.assign(new Error("Invalid die size"), { code: "validation" });
  return size as Die;
}
