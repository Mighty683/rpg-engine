import { request } from "../../shared/api";
import type { GmNpc, NpcRead, NpcWrite } from "./types";
export type { GmNpc, NpcAttackRecord, NpcProfile, NpcRead, NpcWrite } from "./types";

export const api = {
  list: (gameId: string) => request<{ npcs: NpcRead[] }>(`/api/games/${gameId}/npcs`),
  create: (gameId: string, id: string, npc: NpcWrite) =>
    request<{ npc: GmNpc }>(`/api/games/${gameId}/npcs`, {
      method: "POST",
      body: JSON.stringify({ id, npc }),
    }),
  update: (gameId: string, id: string, expectedRevision: number, npc: NpcWrite) =>
    request<{ npc: GmNpc }>(`/api/games/${gameId}/npcs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ expectedRevision, npc }),
    }),
  remove: (gameId: string, id: string, expectedRevision: number) =>
    request<void>(`/api/games/${gameId}/npcs/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    }),
};
