/** Prototype composition: real HTTP clients, intercepted only inside Histoire by MSW. */
import type { App } from "vue";
import { apiServicesKey } from "../src/shared/api-services";
import { authApi } from "../src/modules/auth/api";
import { api as characters } from "../src/modules/characters/api";
import { api as games } from "../src/modules/games/api";
import { api as gameTable } from "../src/modules/game-table/api";
import { invitationApi } from "../src/modules/invitations/api";
import { api as players } from "../src/modules/players/api";

export { resetPrototypeBackend, setPrototypeScenario } from "./mock-backend/store";
export type { PrototypeScenario } from "./mock-backend/types";
export const prototypeGameId = "prototype-game";
export const prototypePlayerId = "member-nera";

export const prototypeApiServices = {
  auth: authApi,
  characters,
  games,
  gameTable,
  invitations: invitationApi,
  players,
};

export function providePrototypeApiServices(app: App) {
  app.provide(apiServicesKey, prototypeApiServices);
}
