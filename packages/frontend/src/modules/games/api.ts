import { request } from "../../shared/api";

export type System = { id: string; name: string };
export type Game = { id: string; name: string; system: System; createdAt: string; role: "GM" | "Player" };
export type GameMember = {
  id: string;
  accountId: string;
  name: string;
  removed: boolean;
  activeCharacterId: string | null;
  revision: number;
};


export const api = {
  listGames: () => request<{ games: Game[] }>("/api/games"),
  listSystems: () => request<{ systems: System[] }>("/api/rpg-systems"),
  createGame: (input: { name: string; systemId: string }) =>
    request<{ game: Game }>("/api/games", { method: "POST", body: JSON.stringify(input) }),
  getGame: (gameId: string) => request<{ game: Game }>(`/api/games/${gameId}`),
  listGameMembers: (gameId: string) => request<{ members: GameMember[] }>(`/api/games/${gameId}/members`),
  setGameMembership: (gameId: string, membershipId: string, action: "remove" | "restore") =>
    request<{ member: GameMember }>(`/api/games/${gameId}/members/${membershipId}/${action}`, { method: "POST", body: "{}" }),
  selectGameCharacter: (gameId: string, characterId: string | null, expectedRevision: number) =>
    request<{ member: GameMember }>(`/api/games/${gameId}/active-character`, {
      method: "PUT", body: JSON.stringify({ characterId, expectedRevision }),
    }),
  selectMemberCharacter: (gameId: string, membershipId: string, characterId: string | null, expectedRevision: number) =>
    request<{ member: GameMember }>(`/api/games/${gameId}/members/${membershipId}/active-character`, {
      method: "PUT", body: JSON.stringify({ characterId, expectedRevision }),
    }),
};
