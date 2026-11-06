import { Controller, RequestError, Route } from "arrow-express";
import type { Response } from "express";
import type { Pool } from "pg";
import { requireActor, requireWriteOrigin, type Actor } from "./guards.ts";
import { authenticateAccount, getAccount, registerAccount, validateCredentials } from "./service.ts";
import { createSession, revokeSession } from "./sessions.ts";
import { closeSessionStreams } from "../events/streams.ts";

const sessionDuration = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(response: Response, token: string) {
  response.cookie("rpg_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDuration,
  });
}

function clearSessionCookie(response: Response) {
  response.clearCookie("rpg_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

async function issueSession(pool: Pool, response: Response, accountId: string) {
  const session = await createSession(pool, accountId, new Date(Date.now() + sessionDuration));
  setSessionCookie(response, session.token);
}

export function authController(pool: Pool) {
  return Controller()
    .prefix("auth")
    .handler(async (request) => {
      if (request.method !== "GET") requireWriteOrigin(request);
      if (request.path.endsWith("/me") || request.path.endsWith("/logout")) {
        return requireActor(pool, request);
      }
      return null;
    })
    .registerRoutes(
      Route<Actor | null>().method("post").path("register").handler(async (request, response) => {
        const { username, password, fields } = validateCredentials(request.body);
        if (Object.keys(fields).length) throw new RequestError(422, { error: { code: "validation", message: "Check the fields.", fields } });
        let account;
        try {
          account = await registerAccount(pool, username, password);
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new RequestError(409, { error: { code: "username_taken", message: "Username is already in use." } });
          }
          throw error;
        }
        await issueSession(pool, response, account.id);
        response.status(201);
        return { account };
      }),
      Route<Actor | null>().method("post").path("login").handler(async (request, response) => {
        const body = request.body && typeof request.body === "object" ? request.body : {};
        const username = typeof body.username === "string" ? body.username.trim().slice(0, 128) : "";
        const password = typeof body.password === "string" && Buffer.byteLength(body.password, "utf8") <= 1024 ? body.password : "";
        const result = await authenticateAccount(pool, username, password, request.ip ?? "unknown");
        if (result.status === "throttled") throw new RequestError(429, { error: { code: "rate_limited", message: "Too many sign-in attempts. Try again later." } });
        if (result.status === "invalid") throw new RequestError(401, { error: { code: "invalid_credentials", message: "Invalid username or password." } });
        await issueSession(pool, response, result.account.id);
        return { account: result.account };
      }),
      Route<Actor | null>().method("get").path("me").handler(async (request) => {
        const actor = await requireActor(pool, request);
        const account = await getAccount(pool, actor.accountId);
        if (!account) throw new RequestError(401, { error: { code: "unauthorized", message: "Sign in to continue." } });
        return { account };
      }),
      Route<Actor | null>().method("post").path("logout").handler(async (request, response) => {
        const actor = await requireActor(pool, request);
        await revokeSession(pool, actor.sessionId);
        closeSessionStreams(actor.sessionId);
        clearSessionCookie(response);
        return { ok: true };
      }),
    );
}
