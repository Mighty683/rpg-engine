import type { ValidationFields } from "../validation/types.ts";

export type InputErrorBody = {
  code: "bad_request" | "validation";
  message: string;
  fields?: ValidationFields;
};

/** Deliberately excludes URLs, bodies, cookies, SQL, and exception messages. */
type HttpErrorRecord = {
  requestId: string;
  method: string;
  route: string;
  status: number;
  databaseCode?: string;
};
export type HttpErrorLogger = (record: HttpErrorRecord) => void;
export type MutationLimitOptions = { windowMs: number; limit: number };
