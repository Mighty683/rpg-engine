import type { ApiSchema } from "@rpg-engine/api-schema";
import type { Actor } from "../auth/types.ts";
import type { invitations } from "../../database/schema.ts";

export type GameInvitationContext = { actor: Actor; gameId: string };

export type InvitationContext = { actor: Actor; token: string };

type InvitationRecord = ApiSchema["Invitation"];
type InvitationPreview = ApiSchema["InvitationPreview"];
export interface InvitationsService {
  acceptInvitation(
    actor: Actor,
    token: string,
    makeActive?: boolean,
  ): Promise<{ gameId: string; characterId?: string; active?: boolean }>;
  createCharacterInvitation(
    actor: Actor,
    gameId: string,
    characterId: string,
  ): Promise<InvitationRecord>;
  ensureGameInvitation(actor: Actor, gameId: string): Promise<InvitationRecord>;
  listInvitations(actor: Actor, gameId: string): Promise<InvitationRecord[]>;
  previewInvitation(actor: Actor, token: string): Promise<InvitationPreview>;
  updateInvitation(
    actor: Actor,
    gameId: string,
    invitationId: string,
    change: { enabled: boolean } | { rotate: true },
  ): Promise<InvitationRecord>;
}

export type InvitationRow = typeof invitations.$inferSelect;

export type CreateInvitationInput = ApiSchema["CreateInvitation"];
export type UpdateInvitationInput = { enabled: boolean };
export type AcceptInvitationInput = { makeActive: boolean };

export interface InvitationOwnership {
  lockLink(token: string): Promise<{
    gameId: string;
    gmAccountId: string;
    kind: string;
    characterId: string | null;
  } | null>;
  invalidateCharacters(gameId: string, ids: string[]): Promise<void>;
}
