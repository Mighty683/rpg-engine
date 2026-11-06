import { request } from "../../shared/api";

export type GameCharacterSummary = {
  id: string;
  name: string;
  level: number;
  controllerMembershipId: string | null;
  controllerName: string | null;
  canEdit: boolean;
  active: boolean;
  createdAt: string;
};
export type CharacterSummary = {
  id: string;
  playerId: string;
  name: string;
  level: number;
  createdAt: string;
};
export type Character = CharacterSummary & {
  systemId: "fabula-ultima";
  updatedAt: string;
  revision: number;
  sheet: Record<string, unknown>;
  derived: Record<string, unknown>;
};


export const api = {
  listGameCharacters: (gameId: string) =>
    request<{ characters: GameCharacterSummary[] }>(`/api/games/${gameId}/characters`),
  createGameCharacter: (gameId: string, input: { id: string; name: string }) =>
    request<{ character: Character }>(`/api/games/${gameId}/characters`, {
      method: "POST", body: JSON.stringify(input),
    }),
  getGameCharacter: (gameId: string, characterId: string) =>
    request<{ character: Character }>(`/api/games/${gameId}/characters/${characterId}`),
  saveGameCharacter: (gameId: string, characterId: string, expectedRevision: number, changes: Record<string, unknown>) =>
    request<{ character: Character }>(`/api/games/${gameId}/characters/${characterId}`, {
      method: "PATCH", body: JSON.stringify({ expectedRevision, changes }),
    }),
  setGameCharacterActive: (gameId: string, characterId: string, active: boolean) =>
    request<{ character: GameCharacterSummary }>(`/api/games/${gameId}/characters/${characterId}/active`, {
      method: "PUT", body: JSON.stringify({ active }),
    }),
  assignGameCharacter: (gameId: string, characterId: string, membershipId: string | null) =>
    request<{ character: GameCharacterSummary }>(`/api/games/${gameId}/characters/${characterId}/controller`, {
      method: "PATCH", body: JSON.stringify({ membershipId }),
    }),
  deleteGameCharacter: (gameId: string, characterId: string) =>
    request<void>(`/api/games/${gameId}/characters/${characterId}`, { method: "DELETE" }),
  listCharacters: (gameId: string, playerId: string) =>
    request<{ characters: CharacterSummary[] }>(
      `/api/games/${gameId}/players/${playerId}/characters`,
    ),
  createCharacter: (gameId: string, playerId: string, input: { id: string; name: string }) =>
    request<{ character: Character }>(`/api/games/${gameId}/players/${playerId}/characters`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getCharacter: (gameId: string, playerId: string, characterId: string) =>
    request<{ character: Character }>(
      `/api/games/${gameId}/players/${playerId}/characters/${characterId}`,
    ),
  saveCharacter: (
    gameId: string,
    playerId: string,
    characterId: string,
    expectedRevision: number,
    changes: Record<string, unknown>,
  ) =>
    request<{ character: Character }>(
      `/api/games/${gameId}/players/${playerId}/characters/${characterId}`,
      { method: "PATCH", body: JSON.stringify({ expectedRevision, changes }) },
    ),
};
