import { errorReason, operationErrors } from "../../../contracts/http-errors.ts";
import { tr } from "./i18n";

/** Decode within the operation that failed. Unknown responses get local fallback copy. */
export async function apiFailure(response: Response, path: string, method = "GET") {
  const body = await response.json().catch(() => null);
  const detail = body?.error;
  const codes = operationErrors(method, path);
  const code = errorReason(codes, detail?.code) ?? "server_error";
  const message = tr(`errors.${code}`);
  const fields =
    detail?.fields && typeof detail.fields === "object"
      ? Object.fromEntries(
          Object.entries(detail.fields).map(([field, value]) => [
            field,
            tr(`errors.${errorReason(codes, String(value)) ?? "invalid_field"}`),
          ]),
        )
      : undefined;
  return Object.assign(new Error(message), {
    status: response.status,
    payload: { error: { code, message, fields, impact: detail?.impact } },
  });
}
