import express from "express";
import { Application, ExpressAdapter } from "arrow-express";
import type { Pool } from "pg";
import { gamesController } from "./modules/games/controller.ts";
import { rpgSystemsController } from "./modules/rpg-systems/controller.ts";

export function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  const routes = Application()
    .prefix("api")
    .registerControllers(gamesController(pool), rpgSystemsController());
  ExpressAdapter(app, routes).configure(false);
  app.use(
    (
      error: Error & { status?: number },
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error.status === 400) {
        response.status(400).json({ error: { code: "bad_request", message: "Malformed JSON." } });
        return;
      }
      response.status(500).json({ error: { code: "server_error", message: "Request failed." } });
    },
  );
  return app;
}
