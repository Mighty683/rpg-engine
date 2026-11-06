export type System = { id: string; name: string };
export type Game = { id: string; name: string; system: System; createdAt: string; role: "GM" | "Player" };
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
export type GameMember = {
  id: string;
  accountId: string;
  name: string;
  removed: boolean;
  activeCharacterId: string | null;
  revision: number;
};
export type GameInvitation = {
  id: string;
  kind: "game" | "character";
  characterId: string | null;
  enabled: boolean;
  url: string;
};
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
    if (response.status === 401) window.dispatchEvent(new Event("session-expired"));
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listGames: () => request<{ games: Game[] }>("/api/games"),
  listSystems: () => request<{ systems: System[] }>("/api/rpg-systems"),
  createGame: (input: { name: string; systemId: string }) =>
    request<{ game: Game }>("/api/games", { method: "POST", body: JSON.stringify(input) }),
  getGame: (gameId: string) => request<{ game: Game }>(`/api/games/${gameId}`),
  listGameMembers: (gameId: string) => request<{ members: GameMember[] }>(`/api/games/${gameId}/members`),
  setGameMembership: (gameId: string, membershipId: string, action: "remove" | "restore") =>
    request<{ member: GameMember }>(`/api/games/${gameId}/members/${membershipId}/${action}`, { method: "POST", body: "{}" }),
  listGameInvitations: (gameId: string) => request<{ invitations: GameInvitation[] }>(`/api/games/${gameId}/invitations`),
  createGameInvitation: (gameId: string, input: { kind: "game" | "character"; characterId?: string }) =>
    request<{ invitation: GameInvitation }>(`/api/games/${gameId}/invitations`, { method: "POST", body: JSON.stringify(input) }),
  updateGameInvitation: (gameId: string, invitationId: string, enabled: boolean) =>
    request<{ invitation: GameInvitation }>(`/api/games/${gameId}/invitations/${invitationId}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  rotateGameInvitation: (gameId: string, invitationId: string) =>
    request<{ invitation: GameInvitation }>(`/api/games/${gameId}/invitations/${invitationId}/rotate`, { method: "POST", body: "{}" }),
  selectGameCharacter: (gameId: string, characterId: string | null, expectedRevision: number) =>
    request<{ member: GameMember }>(`/api/games/${gameId}/active-character`, {
      method: "PUT", body: JSON.stringify({ characterId, expectedRevision }),
    }),
  selectMemberCharacter: (gameId: string, membershipId: string, characterId: string | null, expectedRevision: number) =>
    request<{ member: GameMember }>(`/api/games/${gameId}/members/${membershipId}/active-character`, {
      method: "PUT", body: JSON.stringify({ characterId, expectedRevision }),
    }),
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
