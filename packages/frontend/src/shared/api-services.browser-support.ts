/** Explicit HTTP-service composition for browser tests that mock the transport. */
import type { ApiServices } from "./api-services";
import { authApi } from "../modules/auth/api";
import { api as characters } from "../modules/characters/api";
import { api as gameTable } from "../modules/game-table/api";
import { api as npcs } from "../modules/npcs/api";
import { api as games } from "../modules/games/api";
import { invitationApi } from "../modules/invitations/api";
import { api as players } from "../modules/players/api";

export const browserApiServices: ApiServices = {
  auth: authApi,
  characters,
  gameTable,
  npcs,
  games,
  invitations: invitationApi,
  players,
};
