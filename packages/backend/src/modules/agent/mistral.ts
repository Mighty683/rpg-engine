import type { AgentMessage, AgentProvider, AgentCall } from "./types.ts";
import { agentError, agentFailure } from "./errors.ts";

function providerMessage(message: AgentMessage) {
  if (message.role === "assistant" && !message.calls.length)
    return { role: "assistant", content: message.content };
  if (message.role === "assistant")
    return {
      role: message.role,
      content: message.content,
      tool_calls: message.calls.map((call) => ({
        type: "function",
        id: call.id,
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  if (message.role === "tool")
    return {
      role: "tool",
      name: message.name,
      content: message.content,
      tool_call_id: message.callId,
    };
  return message;
}
function parseCall(value: unknown): AgentCall {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("function" in value) ||
    !value.function ||
    typeof value.function !== "object" ||
    !("name" in value.function) ||
    typeof value.function.name !== "string" ||
    !("arguments" in value.function) ||
    typeof value.function.arguments !== "string"
  )
    throw agentFailure("invalid_provider_response");
  return { id: value.id, name: value.function.name, arguments: value.function.arguments };
}
export function createMistralProvider(model: string, key: string): AgentProvider {
  return {
    async complete({ messages, tools, maxOutputTokens, signal }) {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        signal,
        redirect: "error",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.map(providerMessage),
          tools: tools.map((tool) => ({ type: "function", function: tool })),
          parallel_tool_calls: false,
          max_tokens: maxOutputTokens,
          temperature: 0,
        }),
      }).catch(() => {
        throw agentError("agent_unavailable");
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw agentError("agent_unavailable");
      }
      const data = await response.json().catch(() => {
        throw agentFailure("invalid_provider_response");
      });
      const message = data?.choices?.[0]?.message;
      const inputTokens = data?.usage?.prompt_tokens,
        outputTokens = data?.usage?.completion_tokens;
      if (
        !message ||
        !Number.isSafeInteger(inputTokens) ||
        inputTokens < 1 ||
        !Number.isSafeInteger(outputTokens) ||
        outputTokens < 0 ||
        (message.content != null && typeof message.content !== "string") ||
        (message.tool_calls != null && !Array.isArray(message.tool_calls))
      )
        throw agentFailure("invalid_provider_response");
      return {
        text: message.content ?? "",
        calls: (message.tool_calls ?? []).map(parseCall),
        inputTokens,
        outputTokens,
      };
    },
  };
}
