import type { ObjectInputSchema } from "../../shared/validation/types.ts";
import type { GameActor } from "../games/types.ts";
import type { CharacterChanges, CharactersService, PartyCharacter } from "../characters/types.ts";
import type { NpcWrite, NpcRecord, NpcsService } from "../npcs/types.ts";
import type { CreateThrowInput, ThrowRecord, ThrowsService } from "../throws/types.ts";
import type { GameNotesRetrieval } from "../game-notes/types.ts";

export type AgentToolName =
  | "read_character"
  | "read_npc"
  | "read_throws"
  | "search_notes"
  | "get_notes"
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
      changes: Pick<CharacterChanges, "name" | "theme" | "level" | "baseDice" | "resources">;
    }
  | {
      kind: "edit_npc";
      npcId: string;
      expectedRevision: number;
      changes: Partial<Omit<NpcWrite, "visibility" | "attacks">>;
    };
export type AgentTurnInput = { message: string };
export type AgentTurn = {
  id: string;
  reply: string;
  tools: AgentToolSummary[];
  action?: AgentAction;
};
export type AgentHistoryTurn = Omit<AgentTurn, "action"> & {
  message: string;
  author: string;
  roll?: Pick<ThrowRecord, "characterName" | "equipmentName" | "private" | "outcome">;
};
export type AgentHistoryPage = { turns: AgentHistoryTurn[]; nextBefore: string | null };
export type AgentPageQuery = { before: string | null; limit: number };
export type AgentContext = { actor: GameActor; gameId: string };
export type AgentRunContext = AgentContext & {
  requestId?: string;
  reauthorize(): Promise<void>;
  signal: AbortSignal;
};
export interface AgentHistory {
  page(context: AgentContext, query: AgentPageQuery): Promise<AgentHistoryPage>;
  append(
    context: AgentContext & { signal?: AbortSignal },
    turn: Omit<AgentHistoryTurn, "author">,
  ): Promise<void>;
}
export interface AgentRuntime {
  available: boolean;
  busy(gameId: string): boolean;
  run(context: AgentRunContext, message: string): Promise<AgentTurn>;
}

export type AgentCall = { id: string; name: string; arguments: string };
export type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; calls: AgentCall[] }
  | { role: "tool"; content: string; callId: string; name: string };

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  parameters: ObjectInputSchema;
}
export interface AgentCompletion {
  text: string;
  calls: AgentCall[];
  inputTokens: number;
  outputTokens: number;
}
export interface AgentProvider {
  complete(request: {
    messages: readonly AgentMessage[];
    tools: readonly AgentToolDefinition[];
    maxOutputTokens: number;
    signal: AbortSignal;
  }): Promise<AgentCompletion>;
}
export interface AgentToolResult {
  data: unknown;
  label: string;
  action?: AgentAction;
}
export interface AgentTool extends AgentToolDefinition {
  execute(args: Record<string, unknown>): Promise<AgentToolResult>;
}
export interface AgentTable {
  party: PartyCharacter[];
  npcs: NpcRecord[];
}
export interface AgentReadDependencies {
  characters: CharactersService;
  npcs: NpcsService;
  throws: ThrowsService;
  /** Read-only GM notebook retrieval for the search_notes and get_notes tools. */
  notes: GameNotesRetrieval;
}
export interface AgentToolContext extends AgentRunContext, AgentReadDependencies {
  message: string;
  table: AgentTable;
  visibleThrows(): Promise<ThrowRecord[]>;
}
export type AgentToolFactory = (context: AgentToolContext) => AgentTool[];
