import type { Actor } from "../auth/types.ts";
import type { GameAccessFactory } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";

import {
  acceptInvitation,
  createCharacterInvitation,
  ensureGameInvitation,
  listInvitations,
  previewInvitation,
  updateInvitation,
} from "./service.ts";
import type { Database } from "../../database/types.ts";
import type { Configuration } from "../../types.ts";

export function createInvitationsService(
  database: Database,
  config: Configuration,
  events: GameEvents,
  gameAccessFor: GameAccessFactory,
) {
  return {
    acceptInvitation: (actor: Actor, token: string, makeActive?: boolean) =>
      acceptInvitation({ events, database }, actor, token, makeActive),
    createCharacterInvitation: (actor: Actor, gameId: string, characterId: string) =>
      createCharacterInvitation({ gameAccessFor, config, database }, actor, gameId, characterId),
    ensureGameInvitation: (actor: Actor, gameId: string) =>
      ensureGameInvitation({ gameAccessFor, config, database }, actor, gameId),
    listInvitations: (actor: Actor, gameId: string) =>
      listInvitations({ config, database }, actor, gameId),
    previewInvitation: (actor: Actor, token: string) => previewInvitation(database, actor, token),
    updateInvitation: (
      actor: Actor,
      gameId: string,
      invitationId: string,
      change: { enabled: boolean } | { rotate: true },
    ) => updateInvitation({ gameAccessFor, config, database }, actor, gameId, invitationId, change),
  };
}
