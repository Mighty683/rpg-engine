import { Controller, RequestError, Route } from "arrow-express";
import type { Response } from "express";
import type { Services } from "../../services.ts";
import { requireWriteOrigin, type Actor } from "./guards.ts";
import { validateCredentials } from "./service.ts";

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

async function issueSession(auth: Services["auth"], response: Response, accountId: string) {
  const session = await auth.createSession(accountId, new Date(Date.now() + sessionDuration));
  setSessionCookie(response, session.token);
}

async function withAvailabilityResponse<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    if ((error as { code?: string }).code === "auth_busy") {
      throw new RequestError(503, { error: { code: "auth_busy", message: "Sign-in service busy. Try again." } });
    }
    throw error;
  }
}

export function authController(services: Pick<Services, "auth">) {
  return Controller()
    .prefix("auth")
    .handler(async (request) => {
      if (request.method !== "GET") requireWriteOrigin(request);
      if (request.path.endsWith("/me") || request.path.endsWith("/logout")) {
        return services.auth.requireActor(request);
      }
      return null;
    })
    .registerRoutes(
      Route<Actor | null>().method("post").path("register").handler(async (request, response) => {
        const { username, password, fields } = validateCredentials(request.body);
        if (Object.keys(fields).length) throw new RequestError(422, { error: { code: "validation", message: "Check the fields.", fields } });
        let account;
        try {
          account = await withAvailabilityResponse(() => services.auth.registerAccount(username, password));
        } catch (error) {
          const databaseError = (error as { cause?: unknown }).cause ?? error;
          if ((databaseError as { code?: string }).code === "23505") {
            throw new RequestError(409, { error: { code: "username_taken", message: "Username is already in use." } });
          }
          throw error;
        }
        await issueSession(services.auth, response, account.id);
        response.status(201);
        return { account };
      }),
      Route<Actor | null>().method("post").path("login").handler(async (request, response) => {
        const body = request.body && typeof request.body === "object" ? request.body : {};
        const username = typeof body.username === "string" ? body.username.trim().slice(0, 128) : "";
        const password = typeof body.password === "string" && Buffer.byteLength(body.password, "utf8") <= 1024 ? body.password : "";
        const result = await withAvailabilityResponse(() => services.auth.authenticateAccount(username, password));
        if (result.status === "invalid") throw new RequestError(401, { error: { code: "invalid_credentials", message: "Invalid username or password." } });
        await issueSession(services.auth, response, result.account.id);
        return { account: result.account };
      }),
      Route<Actor | null>().method("get").path("me").handler(async (request) => {
        const actor = await services.auth.requireActor(request);
        const account = await services.auth.getAccount(actor.accountId);
        if (!account) throw new RequestError(401, { error: { code: "unauthorized", message: "Sign in to continue." } });
        return { account };
      }),
      Route<Actor | null>().method("post").path("logout").handler(async (request, response) => {
        const actor = await services.auth.requireActor(request);
        await services.auth.logout(actor.sessionId);
        clearSessionCookie(response);
        return { ok: true };
      }),
    );
}
