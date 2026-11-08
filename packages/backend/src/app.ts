import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createCsrfProtection } from "./modules/auth/csrf.ts";
import { PostgresRateStore, authenticationLimiters } from "./modules/auth/rate-limit.ts";
import { Application, ExpressAdapter } from "arrow-express";
import type { Database } from "./database/types.ts";
import { createGameEvents } from "./modules/events/streams.ts";
import { createSessionService } from "./modules/auth/sessions.ts";
import { createAuthService } from "./modules/auth/factory.ts";
import { createGameAccessService } from "./modules/games/service.ts";
import { createGamesService } from "./modules/games/factory.ts";
import { createCharactersService } from "./modules/characters/factory.ts";
import { createThrowsService } from "./modules/throws/factory.ts";
import { createMembershipsService } from "./modules/players/factory.ts";
import { createInvitationsService } from "./modules/invitations/factory.ts";
import { createConfiguration } from "./config.ts";
import type { Configuration } from "./types.ts";
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

export function createApp(database: Database, config: Configuration = createConfiguration()) {
  const { issueCsrfToken, csrfProtection, invalidCsrfTokenError } = createCsrfProtection(config);
  const app = express();
  if (config.trustedProxies.length) app.set("trust proxy", config.trustedProxies);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "96kb" }));
  app.get("/api/auth/csrf", issueCsrfToken);
  app.use("/api", csrfProtection);
  const limits = authenticationLimiters({
    loginAddress: new PostgresRateStore(database, "login-address"),
    loginAccount: new PostgresRateStore(database, "login-account"),
    registration: new PostgresRateStore(database, "registration"),
  });
  app.post("/api/auth/login", limits.loginAddress, limits.loginAccount);
  app.post("/api/auth/register", limits.registration);
  const events = createGameEvents();
  const sessions = createSessionService(database);
  const auth = createAuthService(database, config, events, sessions);
  const games = createGamesService(database);
  const characters = createCharactersService(database, events, createGameAccessService);
  const throws = createThrowsService(database, events, createGameAccessService);
  const memberships = createMembershipsService(database, events, createGameAccessService);
  const invitations = createInvitationsService(database, config, events, createGameAccessService);
  const routes = Application()
    .prefix("api")
    .registerControllers(
      authController({ auth, config }),
      gamesController({ auth, games }),
      charactersController({ auth, games, characters }),
      partyController({ auth, characters }),
      throwsController({ auth, games, throws }),
      membershipsController({ auth, games, memberships }),
      activeSelectionController({ auth, games, memberships }),
      gameInvitationsController({ auth, games, invitations }),
      invitationController({ auth, invitations }),
      gameEventsController({ auth, games, events }),
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
