import { describe, expect, it } from "vite-plus/test";
import { assignedRanks, progressionError, sourcedBenefits } from "./model";
import type { ProgressionClass } from "./types";
const catalog: ProgressionClass[] = ["a", "b", "c", "d", "e", "f"].map((id) => ({
  id,
  name: id,
  description: "",
  benefits: [{ id: "free", name: "Free", description: "", stat: "maxHp", amount: 5 }],
  skills: [
    {
      id,
      name: id,
      description: "",
      maxRank: 10,
      benefits: [
        { id: "ranked", name: "Ranked", description: "", stat: "maxMp", amount: 2, perRank: true },
      ],
    },
  ],
}));

describe("catalog progression", () => {
  it("saves class selection independently while enforcing skill capacity and class limits", () => {
    expect(progressionError(catalog, { a: 1 }, {})).toBeUndefined();
    expect(progressionError(catalog, { a: 3, b: 2 }, { a: 2 })).toBeUndefined();
    expect(progressionError(catalog, { a: 1 }, { a: 2 })).toContain("class level");
    expect(progressionError(catalog, {}, { a: 1 })).toContain("class level");
    expect(progressionError(catalog, { a: 11 }, {})).toContain("class levels");
    const fiveClasses = { a: 1, b: 1, c: 1, d: 1, e: 1 };
    expect(progressionError(catalog, { ...fiveClasses, f: 0 }, {})).toBeUndefined();
    expect(progressionError(catalog, { ...fiveClasses, a: 10, f: 1 }, {})).toContain("5 classes");
    for (const levels of [{ missing: 1 }, { a: -1 }, { a: 1.5 }] as Record<string, number>[])
      expect(progressionError(catalog, levels, {})).toContain("class levels");
    for (const ranks of [{ a: 1.5 }, { missing: 1 }, { a: -1 }, { a: 11 }] as Record<
      string,
      number
    >[])
      expect(progressionError(catalog, { a: 10 }, ranks)).toContain("valid skill ranks");
  });
  it("grants free benefits without skills and scales only learned skill effects", () => {
    expect(assignedRanks(catalog[0]!, { a: 3 })).toBe(3);
    expect(sourcedBenefits(catalog, {}, { a: 1 })).toMatchObject([{ total: 5, isFree: true }]);
    const benefits = sourcedBenefits(catalog, { a: 3 }, { a: 4 });
    expect(benefits.map((benefit) => benefit.total)).toEqual([5, 6]);
    expect(benefits[1]).toMatchObject({ rank: 3, maxRank: 10, isFree: false });
    expect(sourcedBenefits(catalog, {}, { a: 0 })).toEqual([]);
  });
});
