import { request } from "../../src/shared/api";
import { prototypeGameId } from "../api";
import type { Entry, NotesApi } from "./types";

const path = `/api/games/${prototypeGameId}/notes`;
export const notesApi: NotesApi = {
  list: async () => (await request<{ entries: Entry[] }>(path)).entries,
  create: async (id, text) =>
    (
      await request<{ entry: Entry }>(path, {
        method: "POST",
        body: JSON.stringify({ id, ...text }),
      })
    ).entry,
  update: async (entry, changes) =>
    (
      await request<{ entry: Entry }>(`${path}/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ expectedRevision: entry.revision, changes }),
      })
    ).entry,
};
