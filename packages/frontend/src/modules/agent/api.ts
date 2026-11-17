import { request } from "../../shared/api";
import type { AgentStatus, AgentTurn } from "./types";

export const agentApi = {
  status(gameId: string, signal: AbortSignal, before?: string) {
    const query = before ? "?" + new URLSearchParams({ before }).toString() : "";
    return request<AgentStatus>(`/api/games/${gameId}/agent/status${query}`, {
      signal,
      cache: "no-store",
    });
  },
  submit(gameId: string, message: string, signal: AbortSignal) {
    return request<AgentTurn>(`/api/games/${gameId}/agent/turns`, {
      method: "POST",
      body: JSON.stringify({ message }),
      signal,
    });
  },
};
