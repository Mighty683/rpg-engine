import type { MembershipOwnershipFactory } from "../players/types.ts";
import type { CharactersService } from "./types.ts";
import type { GameActor, GameAccessFactory } from "../games/types.ts";
import type { SheetChanges } from "../fabula/types.ts";
import type { GameEvents } from "../events/types.ts";

import {
  createWorkspaceCharacter,
  deleteWorkspaceCharacter,
  getWorkspaceCharacter,
  listWorkspaceCharacters,
  setGmCharacterActive,
  updateWorkspaceCharacter,
} from "./workspace-service.ts";
import { listActiveParty } from "./party-service.ts";
import type { Database } from "../../database/types.ts";

export function createCharactersService(
  database: Database,
  events: GameEvents,
  gameAccessFor: GameAccessFactory,
  assignCharacter: CharactersService["assignCharacter"],
  membershipsFor: MembershipOwnershipFactory,
): CharactersService {
  return {
    assignCharacter,
    createWorkspaceCharacter: (actor: GameActor, gameId: string, id: string, name: string) =>
      createWorkspaceCharacter(
        { gameAccessFor, events, database, membershipsFor },
        actor,
        gameId,
        id,
        name,
      ),
    deleteWorkspaceCharacter: (actor: GameActor, gameId: string, id: string) =>
      deleteWorkspaceCharacter(
        { gameAccessFor, events, database, membershipsFor },
        actor,
        gameId,
        id,
      ),
    getWorkspaceCharacter: (actor: GameActor, gameId: string, id: string) =>
      getWorkspaceCharacter({ gameAccessFor, database }, actor, gameId, id),
    listWorkspaceCharacters: (actor: GameActor, gameId: string) =>
      listWorkspaceCharacters({ gameAccessFor, database }, actor, gameId),
    setGmCharacterActive: (actor: GameActor, gameId: string, id: string, active: boolean) =>
      setGmCharacterActive({ gameAccessFor, events, database }, actor, gameId, id, active),
    updateWorkspaceCharacter: (
      gameId: string,
      actor: GameActor,
      id: string,
      expected: number,
      changes: SheetChanges,
    ) =>
      updateWorkspaceCharacter(
        { gameAccessFor, events, database },
        gameId,
        actor,
        id,
        expected,
        changes,
      ),
    listActiveParty: (actor: GameActor, gameId: string) =>
      listActiveParty({ gameAccessFor, database }, actor, gameId),
  };
}
