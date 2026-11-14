import type { GamesService } from "./types.ts";
import type { GameActor } from "./types.ts";

import { createActorGame, gameAccess, getActorGame, listActorGames } from "./service.ts";
import type { Database } from "../../database/types.ts";

export function createGamesService(database: Database): GamesService {
  return {
    gameAccess: (actor: GameActor, gameId: string) => gameAccess(database, actor, gameId),
    createActorGame: (actor: GameActor, name: string, systemId: string) =>
      createActorGame(database, actor, name, systemId),
    getActorGame: (actor: GameActor, gameId: string) => getActorGame(database, actor, gameId),
    listActorGames: (actor: GameActor) => listActorGames(database, actor),
  };
}
