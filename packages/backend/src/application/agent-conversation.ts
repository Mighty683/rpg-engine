import { agentError, agentFailure } from "../modules/agent/errors.ts";
import type {
  AgentCall,
  AgentMessage,
  AgentProvider,
  AgentTool,
  AgentToolSummary,
} from "../modules/agent/types.ts";
import { compileObjectSchema } from "../shared/validation/parse.ts";
import type { AgentUsage } from "./types.ts";

const instructions = [
  "Help the GM run a Fabula Ultima game. Reply briefly in the GM's language. Use table data and tools for facts. Ask when essential details are missing. Never invent rules, skills, or outcomes. Prepare at most one action for GM approval.",
  "The reference snapshot contains the current table, recent user requests, and the last Agent reply. Act on the latest GM message. Use the earlier context to resolve follow-ups, such as a weapon choice or an amount of HP.",
  "read_character: Read an active character's sheet for stats, equipment, or learned skills. For skill advice, explain the trigger, cost, and relevant effect.",
  "read_npc: Read an NPC's profile. Request GM notes only when needed.",
  "read_throws: Read recent visible rolls or look up the source ID for an explicit reroll.",
  "prepare_throw: Prepare a dice roll, check, attack, or explicit reroll. Use the GM for unattributed rolls. Omit the weapon for a character attack with no named weapon. Use Unarmed for an explicit unarmed strike. For an agility check use DEX + DEX unless the GM specifies another pair.",
  "prepare_character_edit: Propose a character sheet change. For relative HP changes, read current HP and submit the new value.",
  "prepare_npc_edit: Propose an NPC profile change. Use hpDelta for relative HP changes, such as -5 to reduce HP by 5.",
  "Apply known damage or healing with the relevant edit tool. Interpret a bare number as the answer to a pending question when the context supports it.",
].join(" ");
// Each registered name has a single application-owned argument schema for the process lifetime.
const validators = new Map<string, ReturnType<typeof compileObjectSchema>>();

export function initialMessages(
  table: unknown,
  recentUserMessages: string[],
  message: string,
  lastAgentReply?: string,
): AgentMessage[] {
  return [
    { role: "system", content: instructions },
    {
      role: "user",
      content: JSON.stringify({ currentTable: table, recentUserMessages, lastAgentReply }),
    },
    {
      role: "assistant",
      content: "I have the table reference. Ready for the current request.",
      calls: [],
    },
    { role: "user", content: message },
  ];
}
export function guardTurn(signal: AbortSignal) {
  if (signal.aborted) throw agentError("agent_timeout");
}

export async function beforeDeadline<T>(work: () => Promise<T>, signal: AbortSignal) {
  guardTurn(signal);
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => reject(agentError("agent_timeout"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    return await Promise.race([work(), interrupted]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

async function executeCall(tool: AgentTool | undefined, call: AgentCall) {
  if (!tool) throw agentFailure("unknown_tool");
  let validate = validators.get(tool.name);
  if (!validate) {
    validate = compileObjectSchema(tool.parameters);
    validators.set(tool.name, validate);
  }
  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    throw agentFailure("invalid_tool_json");
  }
  if (!validate(args)) throw agentFailure("invalid_tool_arguments");
  return { name: tool.name, output: await tool.execute(args) };
}

/** A bounded loop. Tool arguments and actions are always validated by the server. */
export async function answerTurn(
  provider: AgentProvider,
  registry: AgentTool[],
  messages: AgentMessage[],
  signal: AbortSignal,
  recheck: () => Promise<void>,
  usage: AgentUsage,
) {
  const tools = registry.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
  const summaries: AgentToolSummary[] = [];
  while (usage.calls < 20) {
    await recheck();
    // Byte length plus framing reserves input before the call. Charge reported usage after each response.
    const bound =
      Buffer.byteLength(JSON.stringify({ messages, tools })) +
      128 * (1 + messages.length + tools.length);
    const maxOutputTokens = 2000 - usage.output;
    if (bound > 20_000 - usage.input) throw agentFailure("input_reservation");
    if (maxOutputTokens < 1) throw agentFailure("output_limit");
    usage.calls++;
    const result = await beforeDeadline(
      () => provider.complete({ messages: messages.slice(), tools, maxOutputTokens, signal }),
      signal,
    );
    usage.input += result.inputTokens;
    usage.output += result.outputTokens;
    if (usage.input > 20_000 || usage.output > 2000) throw agentFailure("token_limit");
    if (result.calls.length > 1) throw agentFailure("parallel_tool_calls");
    await recheck();
    const call = result.calls[0];
    if (!call) {
      const reply = result.text.trim();
      if (!reply || Array.from(reply).length > 6000) throw agentFailure("invalid_reply");
      return { reply, tools: summaries };
    }
    if (summaries.length >= 10) throw agentFailure("tool_limit");
    const { name, output } = await executeCall(
      registry.find((t) => t.name === call.name),
      call,
    );
    summaries.push({ tool: name, label: output.label.slice(0, 160) });
    const { action, data } = output;
    if (action) {
      await recheck();
      const reply =
        action.kind === "roll" ? "Roll prepared for review." : "Profile edit prepared for review.";
      return { reply, tools: summaries, action };
    }
    if (
      name === "prepare_throw" &&
      data &&
      typeof data === "object" &&
      "reason" in data &&
      typeof data.reason === "string"
    ) {
      await recheck();
      return { reply: data.reason, tools: summaries };
    }
    messages.push(
      { role: "assistant", content: "", calls: result.calls },
      { role: "tool", name, callId: call.id, content: JSON.stringify(output.data) },
    );
  }
  throw agentFailure("model_limit");
}
