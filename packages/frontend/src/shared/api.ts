export type System = { id: string; name: string };
export type Game = { id: string; name: string; system: System; createdAt: string };
export type Player = {
  id: string;
  gameId: string;
  name: string;
  createdAt: string;
  revision: number;
  activeCharacter: { id: string; name: string } | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    headers,
    ...init,
  });
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const error = new Error(`Request failed (${response.status}`) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const api = {
  listGames: () => request<{ games: Game[] }>("/api/games"),
  listSystems: () => request<{ systems: System[] }>("/api/rpg-systems"),
  createGame: (input: { name: string; systemId: string }) =>
    request<{ game: Game }>("/api/games", { method: "POST", body: JSON.stringify(input) }),
  getGame: (gameId: string) => request<{ game: Game }>(`/api/games/${gameId}`),
  listPlayers: (gameId: string) => request<{ players: Player[] }>(`/api/games/${gameId}/players`),
  createPlayer: (gameId: string, input: { id: string; name: string }) =>
    request<{ player: Player }>(`/api/games/${gameId}/players`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPlayer: (gameId: string, playerId: string) =>
    request<{ player: Player }>(`/api/games/${gameId}/players/${playerId}`),
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
