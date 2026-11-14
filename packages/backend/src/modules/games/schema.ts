import type { InputSchema } from "../../shared/validation/types.ts";
import type { CreateGameInput } from "./types.ts";

export const gameSchema: InputSchema<CreateGameInput> = {
  type: "object",
  required: ["name", "systemId"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 20 },
    systemId: { type: "string" },
  },
  additionalProperties: true,
};
