import { randomBytes } from "node:crypto";
import { doubleCsrf } from "csrf-csrf";
import type { Request, Response } from "express";
import type { Configuration } from "../../types.ts";

export function verifyCsrfConfiguration(config: Configuration) {
  if (config.csrfSecret && Buffer.byteLength(config.csrfSecret) >= 32) return config.csrfSecret;
  if (config.production) throw new Error("CSRF_SECRET must contain at least 32 bytes");
  return "local-development-csrf-secret-do-not-use-in-production";
}

export function createCsrfProtection(config: Configuration) {
  const anonymousCookie = config.production ? "__Host-rpg_csrf_id" : "rpg_csrf_id";
  const csrfCookie = config.production ? "__Host-rpg_csrf" : "rpg_csrf";
  const secret = verifyCsrfConfiguration(config);
  const csrf = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (request) =>
      request.cookies.rpg_session ?? request.cookies[anonymousCookie] ?? "",
    cookieName: csrfCookie,
    cookieOptions: { httpOnly: true, secure: config.production, sameSite: "strict", path: "/" },
  });
  function issueCsrfToken(request: Request, response: Response) {
    if (!request.cookies.rpg_session && !request.cookies[anonymousCookie]) {
      const identifier = randomBytes(32).toString("base64url");
      request.cookies[anonymousCookie] = identifier;
      response.cookie(anonymousCookie, identifier, {
        httpOnly: true,
        secure: config.production,
        sameSite: "strict",
        path: "/",
      });
    }
    response.setHeader("Cache-Control", "no-store");
    response.json({ csrfToken: csrf.generateCsrfToken(request, response) });
  }
  return {
    issueCsrfToken,
    csrfProtection: csrf.doubleCsrfProtection,
    invalidCsrfTokenError: csrf.invalidCsrfTokenError,
  };
}
