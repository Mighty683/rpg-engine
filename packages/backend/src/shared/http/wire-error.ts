import { errorCode, operationErrors } from "../../../../contracts/http-errors.ts";

/** Only structured, public error details cross the HTTP boundary. */
export function wireError(method: string, path: string, body: unknown) {
  const detail = (
    body as { error?: { code?: string; fields?: Record<string, string>; impact?: unknown } } | null
  )?.error;
  const codes = operationErrors(method, path);
  return {
    error: {
      code: errorCode(codes, detail?.code ?? "server_error"),
      ...(detail?.fields && {
        fields: Object.fromEntries(
          Object.entries(detail.fields).map(([field, reason]) => [
            field,
            errorCode(codes, reason, "ERR79"),
          ]),
        ),
      }),
      ...(detail?.code === "skill_removal_confirmation_required" && { impact: detail.impact }),
    },
  };
}
