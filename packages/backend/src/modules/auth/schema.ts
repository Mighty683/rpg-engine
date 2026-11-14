import type { InputSchema } from "../../shared/validation/types.ts";
import type { CredentialsInput } from "./types.ts";

/** Password length uses existing UTF-16 and UTF-8 byte rules in the contract. */
export const credentialsSchema: InputSchema<CredentialsInput> = {
  type: "object",
  required: ["username", "password"],
  properties: {
    username: { type: "string", pattern: "^[A-Za-z0-9_.-]{3,32}$" },
    password: { type: "string" },
  },
  additionalProperties: true,
};

/** Login accepts arbitrary string credentials; malformed values become invalid credentials, not 422. */
export const credentialTextSchema: InputSchema<string> = { type: "string" };
