/** Production HTTP adapter for the game-scoped notes API, over the shared secure request path. */
import { request } from "../../shared/api";
import type { GameNotesClient, NoteEntry, NotePage } from "./types";

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
    request<{ entry: NoteEntry }>(`/api/games/${gameId}/notes/${entryId}`, {
      signal,
      cache: "no-store",
    }).then((result) => result.entry),
  create: (gameId, entry) =>
    request<{ entry: NoteEntry }>(`/api/games/${gameId}/notes`, {
      method: "POST",
      body: JSON.stringify(entry),
    }).then((result) => result.entry),
  update: (gameId, entryId, input) =>
    request<{ entry: NoteEntry }>(`/api/games/${gameId}/notes/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((result) => result.entry),
};
