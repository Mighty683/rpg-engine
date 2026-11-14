import { createCharacterRollReader } from "./modules/characters/roll-reader.ts";
import { createNpcRollReader } from "./modules/npcs/roll-reader.ts";
import { createOwnershipWorkflows } from "./application/ownership.ts";
import { createCharacterOwnership } from "./modules/characters/ownership.ts";
import { createMembershipOwnership } from "./modules/players/ownership.ts";
import { createInvitationOwnership } from "./modules/invitations/ownership.ts";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createCsrfProtection } from "./modules/auth/csrf.ts";
import { PostgresRateStore, authenticationLimiters } from "./modules/auth/rate-limit.ts";
import { Application } from "arrow-express";
import { mountRoutes } from "./shared/http/routes.ts";
import { errorBoundary, requestIdentity } from "./shared/http/error-boundary.ts";
import { mutationLimiter } from "./shared/http/mutation-limit.ts";
import type { Database } from "./database/types.ts";
import { createGameEvents, eventStreamOptions } from "./modules/events/streams.ts";
import { createSessionService } from "./modules/auth/sessions.ts";
import { createAuthService } from "./modules/auth/factory.ts";
import { createGameAccessService } from "./modules/games/service.ts";
import { createGamesService } from "./modules/games/factory.ts";
import { createCharactersService } from "./modules/characters/factory.ts";
import { createNpcsService } from "./modules/npcs/service.ts";
import { npcsController } from "./modules/npcs/controller.ts";
import { createThrowsService } from "./modules/throws/factory.ts";
import { createMembershipsService } from "./modules/players/factory.ts";
import { createInvitationsService } from "./modules/invitations/factory.ts";
import { createConfiguration, validateConfiguration } from "./config.ts";
import type { Configuration, ApplicationOptions, ApplicationRuntime } from "./types.ts";
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
import { mountApiDocumentation } from "./openapi.ts";

export function createApp(
  database: Database,
  config: Configuration = createConfiguration(),
  options: ApplicationOptions = {},
) {
  return createApplication(database, config, options).app;
}

export function createApplication(
  database: Database,
  config: Configuration = createConfiguration(),
  options: ApplicationOptions = {},
): ApplicationRuntime {
  validateConfiguration(config);
  const streamOptions = eventStreamOptions(options.eventStreams);
  const { issueCsrfToken, csrfProtection, invalidCsrfTokenError } = createCsrfProtection(config);
  const app = express();
  if (config.trustedProxies.length) app.set("trust proxy", config.trustedProxies);
  app.use(requestIdentity);
  app.use(helmet());
  if (config.development) mountApiDocumentation(app);
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
  const events = createGameEvents(streamOptions);
  const sessions = createSessionService(database);
  const auth = createAuthService(database, config, events, sessions);
  const limitMutations = mutationLimiter(
    async (request) => {
      auth.requireWriteOrigin(request);
      return auth.requireActor(request);
    },
    new PostgresRateStore(database, "account-mutations"),
    options.mutationLimits,
  );
  app.use(["/api/games", "/api/invitations"], limitMutations);
  const games = createGamesService(database);
  const ownership = createOwnershipWorkflows({
    database,
    events,
    gameAccessFor: createGameAccessService,
    storesFor: (tx) => ({
      characters: createCharacterOwnership(tx),
      memberships: createMembershipOwnership(tx),
      invitations: createInvitationOwnership(tx),
    }),
  });
  const characters = createCharactersService(
    database,
    events,
    createGameAccessService,
    ownership.assignCharacter,
    createMembershipOwnership,
  );
  const npcs = createNpcsService({ database, events, gameAccessFor: createGameAccessService });
  const throws = createThrowsService(database, events, createGameAccessService, (tx) => ({
    characters: createCharacterRollReader(tx),
    npcs: createNpcRollReader(tx),
  }));
  const memberships = createMembershipsService(
    database,
    events,
    createGameAccessService,
    ownership.setMemberRemoved,
  );
  const invitations = createInvitationsService(
    database,
    config,
    createGameAccessService,
    ownership.acceptInvitation,
  );
  const routes = Application()
    .prefix("api")
    .registerControllers(
      authController({ auth, config }),
      gamesController({ auth, games }),
      charactersController({ auth, games, characters }),
      partyController({ auth, characters }),
      throwsController({ auth, games, throws }),
      npcsController({ auth, games, npcs }),
      membershipsController({ auth, games, memberships }),
      activeSelectionController({ auth, games, memberships }),
      gameInvitationsController({ auth, games, invitations }),
      invitationController({ auth, invitations }),
      gameEventsController({ auth, games, events }, streamOptions),
      rpgSystemsController(),
    );
  mountRoutes(app, routes);
  app.use(errorBoundary(invalidCsrfTokenError, options.errorLogger));
  return { app, dispose: () => events.dispose() };
}
