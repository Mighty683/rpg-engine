import { compileSchema } from "../validation/parse.ts";
import { uuidSchema } from "../validation/schema.ts";
import { badRequest } from "./errors.ts";

const validateId = compileSchema(uuidSchema);
export function routeId(value: string | string[]) {
  const id = Array.isArray(value) ? value[0] : value;
  if (!validateId(id)) badRequest("Invalid identifier.");
  return id;
}
