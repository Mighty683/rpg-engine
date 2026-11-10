/** HTTP adapter: persistence and authorization belong to the shared MSW backend. */
import { inject, type InjectionKey } from "vue";
import { request } from "../../src/shared/api";
import type { NpcApi } from "./types";
export const npcApiKey: InjectionKey<NpcApi> = Symbol("prototype-npc-api");
export const npcApi: NpcApi = {
  list: () => request("/api/prototype/npcs"),
  save: (npc, tags) =>
    request(`/api/prototype/npcs/${encodeURIComponent(npc.id)}`, {
      method: "PUT",
      body: JSON.stringify({ npc, tags }),
    }),
  saveCharacterTags: (id, tags) =>
    request(`/api/prototype/characters/${encodeURIComponent(id)}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    }),
};
export function useNpcApi(): NpcApi {
  const services = inject(npcApiKey);
  if (!services) throw new Error("NPC API must be provided by the prototype composition root");
  return services;
}
