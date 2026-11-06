import express from "express";
import { Application, ExpressAdapter } from "arrow-express";
import type { Pool } from "pg";
import { gamesController } from "./modules/games/controller.ts";
import { rpgSystemsController } from "./modules/rpg-systems/controller.ts";
import { authController } from "./modules/auth/controller.ts";
import { charactersController } from "./modules/characters/controller.ts";
import { gameEventsController } from "./modules/events/controller.ts";
import { membershipsController, activeSelectionController } from "./modules/players/membership-controller.ts";
import { gameInvitationsController, invitationController } from "./modules/invitations/controller.ts";

export function createApp(pool: Pool) {
  const app = express();
  app.use(express.json({ limit: "96kb" }));
  const routes = Application()
    .prefix("api")
    .registerControllers(authController(pool), gamesController(pool), charactersController(pool), membershipsController(pool), activeSelectionController(pool), gameInvitationsController(pool), invitationController(pool), gameEventsController(pool), rpgSystemsController());
  ExpressAdapter(app, routes).configure(false);
  app.use(
    (
      error: Error & { status?: number },
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
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
