import { RequestError } from "arrow-express";
import type { ValidationFields } from "../validation/types.ts";
import type { InputErrorBody } from "./types.ts";

function rejectInput(status: 400 | 422, error: InputErrorBody): never {
  throw new RequestError(status, { error });
}

/** Malformed envelopes and identifiers retain the API's 400 response. */
export function badRequest(message = "Invalid request."): never {
  return rejectInput(400, { code: "bad_request", message });
}

/** Field validation remains separate from transport shape and authorization failures. */
export function validationError(fields: ValidationFields, message = "Check the fields."): never {
  return rejectInput(422, { code: "validation", message, fields });
}
