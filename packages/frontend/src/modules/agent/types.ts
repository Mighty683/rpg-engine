import type { ApiSchema } from "@rpg-engine/api-schema";
import type { Sheet } from "../characters/sheet/types";
import type { CreateThrowInput } from "../game-table/types";
import type { NpcWrite } from "../npcs/types";

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "tool";
  text: string;
  roll?: HistoryTurn["roll"];
};
type AgentToolSummary = ApiSchema["AgentToolSummary"];
export type AgentAction =
  | { kind: "roll"; input: CreateThrowInput; targetLabel?: string }
  | {
      kind: "edit_character";
      characterId: string;
      expectedRevision: number;
      changes: Partial<Pick<Sheet, "name" | "theme" | "level">> & {
        baseDice?: Partial<Sheet["baseDice"]>;
        resources?: Partial<Sheet["resources"]>;
      };
    }
  | {
      kind: "edit_npc";
      npcId: string;
      expectedRevision: number;
      changes: Partial<Omit<NpcWrite, "attacks" | "visibility">>;
    };
export type AgentTurn = {
  id: string;
  reply: string;
  tools: AgentToolSummary[];
  action?: AgentAction;
};
export type HistoryTurn = ApiSchema["AgentStatus"]["turns"][number];
export type AgentStatus = ApiSchema["AgentStatus"];

export type AgentEditRequest = {
  gameId: string;
  action: Exclude<AgentAction, { kind: "roll" }>;
  saveNpc(id: string, revision: number, next: NpcWrite): Promise<void>;
};
export type EditDifference = { field: string; oldValue: unknown; newValue: unknown };
export type RollPreview = { name: string; formula: string; sizes: number[] };
