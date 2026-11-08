import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import {
  issueCsrfToken,
  csrfProtection,
  invalidCsrfTokenError,
  verifyCsrfConfiguration,
} from "./modules/auth/csrf.ts";
import { authenticationLimiters } from "./modules/auth/rate-limit.ts";
import { Application, ExpressAdapter } from "arrow-express";
import type { Database } from "./database/client.ts";
import { createServices } from "./services.ts";
import { gamesController } from "./modules/games/controller.ts";
import { rpgSystemsController } from "./modules/rpg-systems/controller.ts";
import { authController } from "./modules/auth/controller.ts";
import { charactersController } from "./modules/characters/controller.ts";
import { gameEventsController } from "./modules/events/controller.ts";
import {
  membershipsController,
  activeSelectionController,
} from "./modules/players/membership-controller.ts";
import {
  gameInvitationsController,
  invitationController,
} from "./modules/invitations/controller.ts";
import { partyController } from "./modules/characters/party-controller.ts";
import { throwsController } from "./modules/throws/controller.ts";

export function createApp(database: Database) {
  verifyCsrfConfiguration();
  const app = express();
  const proxySetting = process.env.TRUSTED_PROXIES?.trim();
  if (process.env.NODE_ENV === "production" && !proxySetting) {
    throw new Error("TRUSTED_PROXIES is required in production; use 'none' for direct access");
  }
  const trustedProxies =
    proxySetting === "none"
      ? []
      : proxySetting
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean);
  if (trustedProxies?.length) app.set("trust proxy", trustedProxies);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "96kb" }));
  app.get("/api/auth/csrf", issueCsrfToken);
  app.use("/api", csrfProtection);
  const limits = authenticationLimiters(database);
  app.post("/api/auth/login", limits.loginAddress, limits.loginAccount);
  app.post("/api/auth/register", limits.registration);
  const services = createServices(database);
  const routes = Application()
    .prefix("api")
    .registerControllers(
      authController(services),
      gamesController(services),
      charactersController(services),
      partyController(services),
      throwsController(services),
      membershipsController(services),
      activeSelectionController(services),
      gameInvitationsController(services),
      invitationController(services),
      gameEventsController(services),
      rpgSystemsController(),
    );
  ExpressAdapter(app, routes).configure(false);
  app.use(
    (
      error: Error & { status?: number },
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if ((error as Error & { code?: string }).code === "auth_busy") {
        response
          .status(503)
          .json({ error: { code: "auth_busy", message: "Sign-in service busy. Try again." } });
        return;
      }
      if (error === invalidCsrfTokenError) {
        response
          .status(403)
          .json({ error: { code: "invalid_csrf", message: "Invalid CSRF token." } });
        return;
      }
      if (error.status === 400 || error.status === 413) {
        response.status(error.status).json({
          error: {
            code: error.status === 413 ? "payload_too_large" : "bad_request",
            message: error.status === 413 ? "Request body is too large." : "Malformed JSON.",
          },
        });
        return;
      }
      response.status(500).json({ error: { code: "server_error", message: "Request failed." } });
    },
  );
  return app;
}
