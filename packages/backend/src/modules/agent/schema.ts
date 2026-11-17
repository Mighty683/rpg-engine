import type { InputSchema } from "../../shared/validation/types.ts";
import type { AgentTurnInput, AgentToolSummary } from "./types.ts";

export const agentTurnInputSchema: InputSchema<AgentTurnInput> = {
  type: "object",
  required: ["message"],
  properties: { message: { type: "string", minLength: 1, maxLength: 2000 } },
  additionalProperties: false,
};
export const agentToolsSchema: InputSchema<AgentToolSummary[]> = {
  type: "array",
  maxItems: 10,
  items: {
    type: "object",
    required: ["tool", "label"],
    properties: {
      tool: {
        type: "string",
        enum: [
          "read_character",
          "read_npc",
          "read_throws",
          "prepare_throw",
          "prepare_character_edit",
          "prepare_npc_edit",
        ],
      },
      label: { type: "string", minLength: 1, maxLength: 160 },
    },
    additionalProperties: false,
  },
};
