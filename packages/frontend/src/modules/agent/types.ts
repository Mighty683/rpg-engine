import type { Sheet } from "../characters/sheet/types";
import type { CreateThrowInput, ThrowRecord } from "../game-table/types";
import type { NpcWrite } from "../npcs/api";

export type ChatMessage = {
  id: string;
  role: "user" | "agent" | "tool";
  text: string;
  roll?: HistoryTurn["roll"];
};
export type AgentToolName =
  | "read_character"
  | "read_npc"
  | "read_throws"
  | "prepare_throw"
  | "prepare_character_edit"
  | "prepare_npc_edit";
export type AgentToolSummary = { tool: AgentToolName; label: string };
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
export type HistoryTurn = Omit<AgentTurn, "action"> & {
  message: string;
  author: string;
  roll?: Pick<ThrowRecord, "characterName" | "equipmentName" | "private" | "outcome">;
};
export type AgentStatus = {
  available: boolean;
  busy: boolean;
  nextBefore: string | null;
  turns: HistoryTurn[];
};
