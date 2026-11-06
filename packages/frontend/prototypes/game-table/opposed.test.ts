import { expect, test } from "vite-plus/test";
import { rollOpposed, type OpposedSide } from "./opposed";

const side = (name: string, modifier = 0): OpposedSide => ({ name, modifier, dice: [{ attribute: "DEX", size: 8 }, { attribute: "MIG", size: 10 }] });
const results = (faces: number[]) => {
  let index = 0;
  return () => (faces[index++]! - 0.5) / (index % 2 ? 8 : 10);
};

test("compares opposed totals, criticals, fumbles and ties", () => {
  expect(rollOpposed([side("A", 1), side("B")], results([4, 5, 4, 5])).winner).toBe(0);
  expect(rollOpposed([side("A"), side("B", 10)], results([6, 6, 8, 9])).winner).toBe(0);
  expect(rollOpposed([side("A", 100), side("B")], results([1, 1, 2, 2])).winner).toBe(1);
  expect(rollOpposed([side("A"), side("B")], results([6, 6, 7, 7])).winner).toBeNull();
  expect(rollOpposed([side("A"), side("B")], results([1, 1, 1, 1])).winner).toBeNull();
  expect(rollOpposed([side("A"), side("B")], results([4, 5, 5, 4])).winner).toBeNull();
});

test("compares other dice pools without applying two-die critical rules", () => {
  const first: OpposedSide = { name: "A", modifier: 0, dice: [{ attribute: "", size: 6 }, { attribute: "", size: 6 }] };
  const second: OpposedSide = { name: "B", modifier: 0, dice: [{ attribute: "", size: 6 }, { attribute: "", size: 6 }, { attribute: "", size: 6 }] };
  const result = rollOpposed([first, second], () => 0.99);
  expect(result.fabulaCheck).toBe(false);
  expect(result.first.special).toBe("");
  expect(result.second.total).toBe(18);
  expect(result.winner).toBe(1);
  const single = rollOpposed([{ ...first, dice: first.dice.slice(0, 1) }, second], () => 0);
  expect(single.first.total).toBe(1);
  expect(single.winner).toBe(1);
});
