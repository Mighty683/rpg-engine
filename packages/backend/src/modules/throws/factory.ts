import type { GameActor, GameAccessFactory } from "../games/types.ts";
import type { DieSource } from "../fabula/types.ts";
import type { CreateThrowInput } from "./types.ts";
import type { GameEvents } from "../events/types.ts";

import { createThrow, listThrows, removeThrow } from "./service.ts";
import type { Database } from "../../database/types.ts";

export function createThrowsService(
  database: Database,
  events: GameEvents,
  gameAccessFor: GameAccessFactory,
) {
  return {
    createThrow: (
      actor: GameActor,
      gameId: string,
      input: CreateThrowInput,
      dieSource?: DieSource,
    ) => createThrow({ gameAccessFor, events, database }, actor, gameId, input, dieSource),
    listThrows: (actor: GameActor, gameId: string, before: number | null, limit: number) =>
      listThrows({ gameAccessFor, database }, actor, gameId, before, limit),
    removeThrow: (actor: GameActor, gameId: string, throwId: string) =>
      removeThrow({ gameAccessFor, events, database }, actor, gameId, throwId),
  };
}
