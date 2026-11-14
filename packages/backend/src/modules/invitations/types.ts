import type { Actor } from "../auth/types.ts";
import type { createInvitationsService } from "./factory.ts";
import type { invitations } from "../../database/schema.ts";

export type GameInvitationContext = { actor: Actor; gameId: string };

export type InvitationContext = { actor: Actor; token: string };

export type InvitationsService = ReturnType<typeof createInvitationsService>;

export type InvitationRow = typeof invitations.$inferSelect;

export type CreateInvitationInput = { kind: "game" } | { kind: "character"; characterId: string };
export type UpdateInvitationInput = { enabled: boolean };
export type AcceptInvitationInput = { makeActive: boolean };
