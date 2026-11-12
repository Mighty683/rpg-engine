import { request } from "../../shared/api";
import type { Attribute } from "../game-table/types";

export type NpcAttackRecord = {
  id: string;
  name: string;
  reach: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  damageBonus: number;
  damageType: string;
};
export type NpcProfile = {
  name: string;
  relationship: "enemy" | "neutral" | "friend";
  level: number;
  baseDice: Record<Attribute, number>;
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  defense: number;
  magicDefense: number;
  attacks: NpcAttackRecord[];
};
export type NpcWrite = NpcProfile & { visibility: "hidden" | "visible" | "known"; notes: string };
export type GmNpc = NpcWrite & {
  view: "gm";
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type NpcRead =
  | GmNpc
  | ({ view: "known"; id: string } & NpcProfile)
  | { view: "visible"; id: string; name: string; relationship: NpcProfile["relationship"] };
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
