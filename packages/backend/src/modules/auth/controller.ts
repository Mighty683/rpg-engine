import type { AuthService, Actor } from "./types.ts";
import { Controller, RequestError, Route } from "arrow-express";
import type { Response } from "express";

import type { Configuration } from "../../types.ts";

import { validateCredentials, parseLoginCredentials } from "./contract.ts";

const sessionDuration = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(response: Response, token: string, production: boolean) {
  response.cookie("rpg_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: sessionDuration,
  });
}

function clearSessionCookie(response: Response, production: boolean) {
  response.clearCookie("rpg_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
  });
}

async function issueSession(
  auth: AuthService,
  response: Response,
  accountId: string,
  production: boolean,
) {
  const session = await auth.createSession(accountId, new Date(Date.now() + sessionDuration));
  setSessionCookie(response, session.token, production);
}

async function withAvailabilityResponse<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if ((error as { code?: string }).code === "auth_busy") {
      throw new RequestError(503, {
        error: { code: "auth_busy", message: "Sign-in service busy. Try again." },
      });
    }
    throw error;
  }
}

export function authController(services: { auth: AuthService; config: Configuration }) {
  return Controller()
    .prefix("auth")
    .handler(async (request) => {
      if (request.method !== "GET") services.auth.requireWriteOrigin(request);
      if (request.path.endsWith("/me") || request.path.endsWith("/logout")) {
        return services.auth.requireActor(request);
      }
      return null;
    })
    .registerRoutes(
      Route<Actor | null>()
        .method("post")
        .path("register")
        .handler(async (request, response) => {
          const { username, password, fields } = validateCredentials(request.body);
          if (Object.keys(fields).length)
            throw new RequestError(422, {
              error: { code: "validation", message: "Check the fields.", fields },
            });
          let account;
          try {
            account = await withAvailabilityResponse(() =>
              services.auth.registerAccount(username, password),
            );
          } catch (error) {
            const databaseError = (error as { cause?: unknown }).cause ?? error;
            if ((databaseError as { code?: string }).code === "23505") {
              throw new RequestError(409, {
                error: { code: "username_taken", message: "Username is already in use." },
              });
            }
            throw error;
          }
          await issueSession(services.auth, response, account.id, services.config.production);
          response.status(201);
          return { account };
        }),
      Route<Actor | null>()
        .method("post")
        .path("login")
        .handler(async (request, response) => {
          const { username, password } = parseLoginCredentials(request.body);
          const result = await withAvailabilityResponse(() =>
            services.auth.authenticateAccount(username, password),
          );
          if (result.status === "invalid")
            throw new RequestError(401, {
              error: { code: "invalid_credentials", message: "Invalid username or password." },
            });
          await issueSession(
            services.auth,
            response,
            result.account.id,
            services.config.production,
          );
          return { account: result.account };
        }),
      Route<Actor | null>()
        .method("get")
        .path("me")
        .handler(async (request) => {
          const actor = await services.auth.requireActor(request);
          const account = await services.auth.getAccount(actor.accountId);
          if (!account)
            throw new RequestError(401, {
              error: { code: "unauthorized", message: "Sign in to continue." },
            });
          return { account };
        }),
      Route<Actor | null>()
        .method("post")
        .path("logout")
        .handler(async (request, response) => {
          const actor = await services.auth.requireActor(request);
          await services.auth.logout(actor.sessionId);
          clearSessionCookie(response, services.config.production);
          return { ok: true };
        }),
    );
}
