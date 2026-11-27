import type { ApiSchema } from "@rpg-engine/api-schema";
import type { GameInvitation, InvitationPreview } from "./types";
import { publicRequest, request as apiRequest } from "../../shared/api";

function request<T>(token: string, accept?: { makeActive: boolean }): Promise<T> {
  return publicRequest<T>(
    `/api/invitations/${encodeURIComponent(token)}${accept ? "/accept" : ""}`,
    accept
      ? {
          method: "POST",
          body: JSON.stringify(accept),
          referrerPolicy: "no-referrer",
        }
      : { referrerPolicy: "no-referrer" },
  );
}
export const invitationApi = {
  listGameInvitations: (gameId: string) =>
    apiRequest<{ invitations: GameInvitation[] }>(`/api/games/${gameId}/invitations`),
  createGameInvitation: (gameId: string, input: ApiSchema["CreateInvitation"]) =>
    apiRequest<{ invitation: GameInvitation }>(`/api/games/${gameId}/invitations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateGameInvitation: (gameId: string, invitationId: string, enabled: boolean) =>
    apiRequest<{ invitation: GameInvitation }>(`/api/games/${gameId}/invitations/${invitationId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  rotateGameInvitation: (gameId: string, invitationId: string) =>
    apiRequest<{ invitation: GameInvitation }>(
      `/api/games/${gameId}/invitations/${invitationId}/rotate`,
      { method: "POST", body: "{}" },
    ),

  preview: (token: string) => request<{ invitation: InvitationPreview }>(token),
  accept: (token: string, makeActive: boolean) =>
    request<{ gameId: string; characterId?: string }>(token, { makeActive }),
};
