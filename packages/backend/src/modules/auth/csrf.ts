import { randomBytes } from "node:crypto";
import { doubleCsrf } from "csrf-csrf";
import type { Request, Response } from "express";

const production = process.env.NODE_ENV === "production";
const anonymousCookie = production ? "__Host-rpg_csrf_id" : "rpg_csrf_id";
const csrfCookie = production ? "__Host-rpg_csrf" : "rpg_csrf";

export function verifyCsrfConfiguration() {
  const value = process.env.CSRF_SECRET;
  if (value && Buffer.byteLength(value) >= 32) return value;
  if (process.env.NODE_ENV === "production")
    throw new Error("CSRF_SECRET must contain at least 32 bytes");
  return "local-development-csrf-secret-do-not-use-in-production";
}

const csrf = doubleCsrf({
  getSecret: verifyCsrfConfiguration,
  getSessionIdentifier: (request) =>
    request.cookies.rpg_session ?? request.cookies[anonymousCookie] ?? "",
  cookieName: csrfCookie,
  cookieOptions: { httpOnly: true, secure: production, sameSite: "strict", path: "/" },
});

export function issueCsrfToken(request: Request, response: Response) {
  if (!request.cookies.rpg_session && !request.cookies[anonymousCookie]) {
    const identifier = randomBytes(32).toString("base64url");
    request.cookies[anonymousCookie] = identifier;
    response.cookie(anonymousCookie, identifier, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
    });
  }
  response.setHeader("Cache-Control", "no-store");
  response.json({ csrfToken: csrf.generateCsrfToken(request, response) });
}

export const csrfProtection = csrf.doubleCsrfProtection;
export const invalidCsrfTokenError = csrf.invalidCsrfTokenError;
