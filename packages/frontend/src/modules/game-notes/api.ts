import type { ApiSchema } from "@rpg-engine/api-schema";
/** Production HTTP adapter for the game-scoped notes API, over the shared secure request path. */
import { request } from "../../shared/api";
import type { GameNotesClient, NotePage } from "./types";

function listQuery(query: { q?: string; cursor?: string }) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export const gameNotesApi: GameNotesClient = {
  list: (gameId, query = {}) =>
    request<NotePage>(`/api/games/${gameId}/notes${listQuery(query)}`, {
      signal: query.signal,
      cache: "no-store",
    }),
  read: (gameId, entryId, signal) =>
    request<ApiSchema["NoteResult"]>(`/api/games/${gameId}/notes/${entryId}`, {
      signal,
      cache: "no-store",
    }).then((result) => result.entry),
  create: (gameId, entry) =>
    request<ApiSchema["NoteResult"]>(`/api/games/${gameId}/notes`, {
      method: "POST",
      body: JSON.stringify(entry),
    }).then((result) => result.entry),
  update: (gameId, entryId, input) =>
    request<ApiSchema["NoteResult"]>(`/api/games/${gameId}/notes/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((result) => result.entry),
};
