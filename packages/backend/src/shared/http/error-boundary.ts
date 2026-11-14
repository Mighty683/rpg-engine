import { randomUUID } from "node:crypto";
import { RequestError } from "arrow-express";
import type { ErrorRequestHandler, RequestHandler } from "express";
import type { HttpErrorLogger } from "./types.ts";

export const requestIdentity: RequestHandler = (_request, response, next) => {
  response.locals.requestId = randomUUID();
  response.setHeader("X-Request-Id", response.locals.requestId);
  next();
};

function databaseCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === "string" && /^[0-9A-Z]{5}$/.test(value.code)) return value.code;
    current = value.cause;
  }
}

function errorResponse(error: unknown, invalidCsrfTokenError: Error) {
  if (error === invalidCsrfTokenError)
    return {
      status: 403,
      body: { error: { code: "invalid_csrf", message: "Invalid CSRF token." } },
    };
  if (error instanceof RequestError) return { status: error.httpCode, body: error.response };
  const value = error as { code?: string; status?: number } | null;
  if (value?.code === "auth_busy")
    return {
      status: 503,
      body: { error: { code: "auth_busy", message: "Sign-in service busy. Try again." } },
    };
  if (["57014", "55P03"].includes(databaseCode(error) ?? ""))
    return {
      status: 503,
      body: { error: { code: "database_busy", message: "Database busy. Try again." } },
    };
  if (value?.status === 400 || value?.status === 413)
    return {
      status: value.status,
      body: {
        error: {
          code: value.status === 413 ? "payload_too_large" : "bad_request",
          message: value.status === 413 ? "Request body is too large." : "Malformed JSON.",
        },
      },
    };
  return { status: 500, body: { error: { code: "server_error", message: "Request failed." } } };
}

/** One response boundary for middleware, controller guards, and service failures. */
export function errorBoundary(
  invalidCsrfTokenError: Error,
  log: HttpErrorLogger = (record) => console.error("HTTP request failed", record),
): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    const { status, body } = errorResponse(error, invalidCsrfTokenError);
    if (status >= 500)
      log({
        requestId: response.locals.requestId,
        method: request.method,
        route: request.route?.path ?? "unmatched",
        status,
        databaseCode: databaseCode(error),
      });
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.status(status).json(body);
  };
}
