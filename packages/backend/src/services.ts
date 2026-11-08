import type { Database } from "./database/client.ts";
import { requireActor } from "./modules/auth/guards.ts";
import {
  authenticateAccount,
  getAccount,
  logout,
  registerAccount,
} from "./modules/auth/service.ts";
import { createSession } from "./modules/auth/sessions.ts";
import {
  createActorGame,
  gameAccess,
  getActorGame,
  listActorGames,
} from "./modules/games/service.ts";
import {
  assignCharacter,
  createWorkspaceCharacter,
  deleteWorkspaceCharacter,
  getWorkspaceCharacter,
  listWorkspaceCharacters,
  setGmCharacterActive,
  updateWorkspaceCharacter,
} from "./modules/characters/workspace-service.ts";
import { listActiveParty } from "./modules/characters/party-service.ts";
import { createThrow, listThrows, removeThrow } from "./modules/throws/service.ts";
import {
  listMembers,
  selectPlayerCharacter,
  setMemberRemoved,
} from "./modules/players/membership.ts";
import {
  acceptInvitation,
  createCharacterInvitation,
  ensureGameInvitation,
  listInvitations,
  previewInvitation,
  updateInvitation,
} from "./modules/invitations/service.ts";

/** Binds infrastructure once, before services are passed to the HTTP layer. */
export function createServices(database: Database) {
  return {
    auth: {
      requireActor: requireActor.bind(null, database),
      authenticateAccount: authenticateAccount.bind(null, database),
      getAccount: getAccount.bind(null, database),
      registerAccount: registerAccount.bind(null, database),
      createSession: createSession.bind(null, database),
      logout: logout.bind(null, database),
    },
    games: {
      gameAccess: gameAccess.bind(null, database),
      createActorGame: createActorGame.bind(null, database),
      getActorGame: getActorGame.bind(null, database),
      listActorGames: listActorGames.bind(null, database),
    },
    characters: {
      assignCharacter: assignCharacter.bind(null, database),
      createWorkspaceCharacter: createWorkspaceCharacter.bind(null, database),
      deleteWorkspaceCharacter: deleteWorkspaceCharacter.bind(null, database),
      getWorkspaceCharacter: getWorkspaceCharacter.bind(null, database),
      listWorkspaceCharacters: listWorkspaceCharacters.bind(null, database),
      setGmCharacterActive: setGmCharacterActive.bind(null, database),
      updateWorkspaceCharacter: updateWorkspaceCharacter.bind(null, database),
      listActiveParty: listActiveParty.bind(null, database),
    },
    throws: {
      createThrow: createThrow.bind(null, database),
      listThrows: listThrows.bind(null, database),
      removeThrow: removeThrow.bind(null, database),
    },
    memberships: {
      listMembers: listMembers.bind(null, database),
      selectPlayerCharacter: selectPlayerCharacter.bind(null, database),
      setMemberRemoved: setMemberRemoved.bind(null, database),
    },
    invitations: {
      acceptInvitation: acceptInvitation.bind(null, database),
      createCharacterInvitation: createCharacterInvitation.bind(null, database),
      ensureGameInvitation: ensureGameInvitation.bind(null, database),
      listInvitations: listInvitations.bind(null, database),
      previewInvitation: previewInvitation.bind(null, database),
      updateInvitation: updateInvitation.bind(null, database),
    },
  };
}

export type Services = ReturnType<typeof createServices>;
