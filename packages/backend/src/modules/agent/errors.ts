export function agentError(code: string, retryAfter?: number) {
  return Object.assign(new Error(code), { code, retryAfter });
}

/** Only fixed diagnostic categories may enter operational logs. */
export function agentFailure(
  reason:
    | "unknown_tool"
    | "invalid_tool_json"
    | "invalid_tool_arguments"
    | "input_reservation"
    | "output_limit"
    | "token_limit"
    | "parallel_tool_calls"
    | "invalid_reply"
    | "model_limit"
    | "tool_limit"
    | "invalid_provider_response",
) {
  return Object.assign(agentError("agent_failed"), { reason });
}
