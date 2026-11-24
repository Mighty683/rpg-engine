import { int32Schema, uuidSchema } from "../../shared/validation/schema.ts";
import type { ObjectInputSchema } from "../../shared/validation/types.ts";

const modifierStats = [
  "maxHp",
  "maxMp",
  "maxIp",
  "defense",
  "magicDefense",
  "dieDex",
  "dieIns",
  "dieMig",
  "dieWlp",
] as const;
const name = { type: "string", minLength: 1, maxLength: 100 };
const description = { type: "string", maxLength: 2000 };
const revision = { ...int32Schema, minimum: 0 };
const benefitIdentity = { id: uuidSchema, name };
const benefit = {
  oneOf: [
    {
      type: "object",
      required: ["id", "kind", "name", "description"],
      properties: {
        ...benefitIdentity,
        kind: { type: "string", const: "text" },
        description: { ...description, minLength: 1 },
      },
      additionalProperties: false,
    },
    {
      type: "object",
      required: ["id", "kind", "name", "stat", "amount"],
      properties: {
        ...benefitIdentity,
        kind: { type: "string", const: "modifier" },
        description,
        stat: { type: "string", enum: modifierStats },
        amount: int32Schema,
        perRank: { type: "boolean" },
      },
      additionalProperties: false,
    },
  ],
};
const benefits = { type: "array", items: benefit, maxItems: 10 };
const skill = {
  type: "object",
  required: ["id", "name", "description", "maxRank", "benefits"],
  properties: {
    ...benefitIdentity,
    description,
    maxRank: { ...int32Schema, minimum: 1 },
    benefits,
  },
  additionalProperties: false,
};
const classDefinitionSchema: ObjectInputSchema = {
  type: "object",
  required: ["name", "description", "freeBenefits", "skills"],
  properties: {
    name,
    description,
    freeBenefits: benefits,
    skills: { type: "array", items: skill, maxItems: 30 },
  },
  additionalProperties: false,
};
export const createTemplateSchema: ObjectInputSchema = {
  type: "object",
  required: ["id", "systemId", "definition"],
  properties: {
    id: uuidSchema,
    systemId: { type: "string", const: "fabula-ultima" },
    definition: classDefinitionSchema,
  },
  additionalProperties: false,
};
export const updateTemplateSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "definition"],
  properties: { expectedRevision: revision, definition: classDefinitionSchema },
  additionalProperties: false,
};
const templateTarget = { templateId: uuidSchema, expectedTemplateRevision: revision };
export const copyClassSchema: ObjectInputSchema = {
  type: "object",
  required: ["id", "templateId", "expectedTemplateRevision"],
  properties: { id: uuidSchema, ...templateTarget },
  additionalProperties: false,
};
export const saveClassToLibrarySchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision", "target"],
  properties: {
    expectedRevision: revision,
    target: {
      oneOf: [
        {
          type: "object",
          required: ["mode", "id", "name"],
          properties: { mode: { type: "string", const: "new" }, id: uuidSchema, name },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["mode", "templateId", "expectedTemplateRevision"],
          properties: { mode: { type: "string", const: "update" }, ...templateTarget },
          additionalProperties: false,
        },
      ],
    },
  },
  additionalProperties: false,
};

/** Echoed server impact: bounded by skill count, but character counts follow live game state. */
const skillRemovalImpact = {
  type: "array",
  maxItems: 30,
  items: {
    type: "object",
    required: ["skillId", "characters"],
    properties: {
      skillId: uuidSchema,
      characters: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["id", "name", "rank"],
          properties: { id: uuidSchema, name, rank: { type: "integer", minimum: 1, maximum: 10 } },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};
export const updateGameClassSchema: ObjectInputSchema = {
  ...updateTemplateSchema,
  properties: { ...updateTemplateSchema.properties, confirmedSkillRemovals: skillRemovalImpact },
};
export const deleteGameClassSchema: ObjectInputSchema = {
  type: "object",
  required: ["expectedRevision"],
  properties: { expectedRevision: revision },
  additionalProperties: false,
};
