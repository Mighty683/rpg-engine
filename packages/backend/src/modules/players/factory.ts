import type { Actor } from "../auth/types.ts";
import type { GameAccessFactory } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";

import { listMembers, selectPlayerCharacter, setMemberRemoved } from "./membership.ts";
import type { Database } from "../../database/types.ts";

export function createMembershipsService(
  database: Database,
  events: GameEvents,
  gameAccessFor: GameAccessFactory,
) {
  return {
    listMembers: (actor: Actor, gameId: string) => listMembers(database, actor, gameId),
    selectPlayerCharacter: (
      actor: Actor,
      gameId: string,
      expectedRevision: number,
      characterId: string | null,
      targetMembershipId?: string,
    ) =>
      selectPlayerCharacter(
        { gameAccessFor, events, database },
        actor,
        gameId,
        expectedRevision,
        characterId,
        targetMembershipId,
      ),
    setMemberRemoved: (actor: Actor, gameId: string, membershipId: string, removed: boolean) =>
      setMemberRemoved({ gameAccessFor, events, database }, actor, gameId, membershipId, removed),
  };
}
