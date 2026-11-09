import type { OpposedSide, OpposedRoll } from "./types";

/** Compare dice pools; Fabula criticals apply only to two standard attribute dice per side. */
export function rollOpposed(sides: [OpposedSide, OpposedSide], random = Math.random) {
  const fabulaCheck = sides.every(
    (side) => side.dice.length === 2 && side.dice.every((die) => [6, 8, 10, 12].includes(die.size)),
  );
  const results = sides.map((side): OpposedRoll => {
    const dice = side.dice.map((die) => ({ ...die, face: Math.floor(random() * die.size) + 1 }));
    const [first, second] = dice;
    const special =
      fabulaCheck && first!.face === 1 && second!.face === 1
        ? "Fumble"
        : fabulaCheck && first!.face === second!.face && first!.face >= 6
          ? "Critical success"
          : "";
    return {
      name: side.name,
      dice,
      bonus: side.modifier,
      total: dice.reduce((sum, die) => sum + die.face, side.modifier),
      special,
    };
  });
  const rank = (result: OpposedRoll) =>
    result.special === "Fumble"
      ? -Infinity
      : result.special === "Critical success"
        ? Infinity
        : result.total;
  const [first, second] = results as [OpposedRoll, OpposedRoll];
  const winner = rank(first) === rank(second) ? null : rank(first) > rank(second) ? 0 : 1;
  return { first, second, winner, fabulaCheck };
}
