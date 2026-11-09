import type { GameInvitation, InvitationPreview } from "./types";
import { secureFetch } from "../../shared/secure-fetch.ts";
import { request as apiRequest } from "../../shared/api";

async function request<T>(token: string, accept?: { makeActive: boolean }): Promise<T> {
  const response = await secureFetch(
    `/api/invitations/${encodeURIComponent(token)}${accept ? "/accept" : ""}`,
    accept
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accept),
          referrerPolicy: "no-referrer",
        }
      : { referrerPolicy: "no-referrer" },
  );
  if (!response.ok)
    throw Object.assign(new Error("Invitation unavailable"), { status: response.status });
  return response.json() as Promise<T>;
}
export const invitationApi = {
  listGameInvitations: (gameId: string) =>
    apiRequest<{ invitations: GameInvitation[] }>(`/api/games/${gameId}/invitations`),
  createGameInvitation: (
    gameId: string,
    input: { kind: "game" | "character"; characterId?: string },
  ) =>
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
