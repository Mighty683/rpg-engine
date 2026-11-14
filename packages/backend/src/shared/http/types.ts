import type { ValidationFields } from "../validation/types.ts";

export type InputErrorBody = {
  code: "bad_request" | "validation";
  message: string;
  fields?: ValidationFields;
};
