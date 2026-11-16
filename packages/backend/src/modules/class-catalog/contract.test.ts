import { expect, it } from "vite-plus/test";
import { parseCreateTemplate, parseUpdateGameClass } from "./contract.ts";
import type { ClassBenefit, ClassDefinition } from "./types.ts";

const uuid = (index: number) => `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`;
const benefit = (index: number): ClassBenefit => ({
  id: uuid(index),
  kind: "text",
  name: `Benefit ${index}`,
  description: "Keeps watch.",
});
const skill = (index: number, benefits = 1): ClassDefinition["skills"][number] => ({
  id: uuid(index),
  name: `Skill ${index}`,
  description: "Warded.",
  maxRank: 2,
  benefits: Array.from({ length: benefits }, (_, position) => benefit(index * 100 + position)),
});
const definition = (overrides: Partial<ClassDefinition> = {}): ClassDefinition => ({
  name: " Guardian ",
  description: "Watch the road.",
  freeBenefits: [benefit(5000)],
  skills: [skill(1), skill(2)],
  ...overrides,
});

function expectInvalid(parse: () => unknown, field: string) {
  try {
    parse();
    throw new Error("Expected the request to be rejected.");
  } catch (error) {
    expect(error).toMatchObject({
      httpCode: 422,
      response: { error: { code: "validation", fields: { [field]: "Invalid value." } } },
    });
  }
}

it("accepts definitions at the persisted-size bounds and normalizes them", () => {
  const text = "g".repeat(2000);
  const largest = definition({
    description: text,
    freeBenefits: Array.from({ length: 10 }, (_, index) => benefit(5000 + index)),
    skills: Array.from({ length: 30 }, (_, index) => skill(index + 1, 10)),
  });
  largest.skills[0]!.description = text;
  largest.skills[0]!.benefits[0]!.description = text;
  const parsed = parseCreateTemplate({
    id: uuid(1).toUpperCase(),
    systemId: "fabula-ultima",
    definition: largest,
  });
  expect(parsed.id).toBe(uuid(1));
  expect(parsed.definition.name).toBe("Guardian");
  expect(parsed.definition.description).toBe(text);
  expect(parsed.definition.freeBenefits).toHaveLength(10);
  expect(parsed.definition.skills).toHaveLength(30);
  expect(parsed.definition.skills[0]!.description).toBe(text);
  expect(parsed.definition.skills[0]!.benefits[0]!.description).toBe(text);
  expect(parsed.definition.skills[29]!.benefits).toHaveLength(10);
});

it.each([
  ["class descriptions", { description: "g".repeat(2001) }, "definition.description"],
  [
    "free benefit lists",
    { freeBenefits: Array.from({ length: 11 }, (_, index) => benefit(index)) },
    "definition.freeBenefits",
  ],
  [
    "skill lists",
    { skills: Array.from({ length: 31 }, (_, index) => skill(index + 1)) },
    "definition.skills",
  ],
  [
    "skill descriptions",
    { skills: [{ ...skill(1), description: "g".repeat(2001) }] },
    "definition.skills.0.description",
  ],
  ["skill benefit lists", { skills: [skill(1, 11)] }, "definition.skills.0.benefits"],
  [
    "benefit descriptions",
    { skills: [{ ...skill(1), benefits: [{ ...benefit(150), description: "g".repeat(2001) }] }] },
    "definition.skills.0.benefits.0.description",
  ],
])("rejects definitions with oversized %s", (_name, overrides, field) => {
  expectInvalid(
    () =>
      parseCreateTemplate({
        id: uuid(1),
        systemId: "fabula-ultima",
        definition: definition(overrides),
      }),
    field,
  );
});

it("bounds echoed skill removal confirmations by the skill count", () => {
  const impact = { skillId: uuid(1), characters: [{ id: uuid(2), name: "Rowan", rank: 2 }] };
  const input = {
    expectedRevision: 0,
    definition: definition(),
    confirmedSkillRemovals: Array.from({ length: 31 }, () => impact),
  };
  expectInvalid(() => parseUpdateGameClass(input), "confirmedSkillRemovals");
  const bounded = { ...input, confirmedSkillRemovals: Array.from({ length: 30 }, () => impact) };
  expect(parseUpdateGameClass(bounded).confirmedSkillRemovals).toHaveLength(30);
});
