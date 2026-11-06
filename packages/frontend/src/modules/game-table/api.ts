import { request } from "../../shared/api";
import type { CreateThrowInput, PartyCharacter, ThrowRecord } from "./contract";

export const api = {
  getGameParty: (gameId: string) => request<{ characters: PartyCharacter[] }>(`/api/games/${gameId}/party`),
  listGameThrows: (gameId: string, options: { before?: number; limit: number }) => {
    const query = new URLSearchParams({ limit: String(options.limit) });
    if (options.before !== undefined) query.set("before", String(options.before));
    return request<{ throws: ThrowRecord[] }>(`/api/games/${gameId}/throws?${query}`);
  },
  createGameThrow: (gameId: string, input: CreateThrowInput) =>
    request<{ throw: ThrowRecord }>(`/api/games/${gameId}/throws`, { method: "POST", body: JSON.stringify(input) }),
  deleteGameThrow: (gameId: string, throwId: string) =>
    request<{ deleted: boolean }>(`/api/games/${gameId}/throws/${throwId}`, { method: "DELETE" }),
};
