import { request } from "../../shared/api";

export type Player = {
  id: string;
  gameId: string;
  name: string;
  createdAt: string;
  revision: number;
  activeCharacter: { id: string; name: string } | null;
};

export const api = {
  listPlayers: (gameId: string) => request<{ players: Player[] }>(`/api/games/${gameId}/players`),
  createPlayer: (gameId: string, input: { id: string; name: string }) =>
    request<{ player: Player }>(`/api/games/${gameId}/players`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPlayer: (gameId: string, playerId: string) =>
    request<{ player: Player }>(`/api/games/${gameId}/players/${playerId}`),
  setActive: (
    gameId: string,
    playerId: string,
    expectedRevision: number,
    characterId: string | null,
  ) =>
    request<{ player: Player }>(`/api/games/${gameId}/players/${playerId}/active-character`, {
      method: "PUT",
      body: JSON.stringify({ expectedRevision, characterId }),
    }),
};
