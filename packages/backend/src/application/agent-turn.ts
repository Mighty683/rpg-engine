import { randomUUID } from "node:crypto";
import { agentError } from "../modules/agent/errors.ts";
import type {
  AgentReadDependencies,
  AgentRunContext,
  AgentRuntime,
  AgentTable,
  AgentToolContext,
} from "../modules/agent/types.ts";
import { createAgentReads } from "./agent-reads.ts";
import { answerTurn, initialMessages, guardTurn, beforeDeadline } from "./agent-conversation.ts";
import type { AgentDependencies, AgentUsage } from "./types.ts";

async function readTable(ctx: AgentRunContext, deps: AgentReadDependencies): Promise<AgentTable> {
  const [party, npcs] = await Promise.all([
    deps.characters.listActiveParty(ctx.actor, ctx.gameId),
    deps.npcs.read(ctx.actor, ctx.gameId),
  ]);
  return { party: party.characters.slice(0, 50), npcs: npcs.slice(0, 50) };
}

async function scopedReads(ctx: AgentRunContext, deps: AgentDependencies, message: string) {
  const table = await readTable(ctx, deps);
  const seenThrows = new Set<string>();
  const loadThrows = async () =>
    (await deps.throws.listThrows(ctx.actor, ctx.gameId, null, 20)).throws;
  const context: AgentToolContext = {
    ...ctx,
    ...deps,
    table,
    message,
    visibleThrows: async () => {
      const records = await loadThrows();
      for (const record of records) seenThrows.add(record.id);
      return records;
    },
  };
  async function recheck() {
    guardTurn(ctx.signal);
    await ctx.reauthorize();
    const now = await readTable(ctx, deps);
    for (const group of ["party", "npcs"] as const) {
      const allowed = new Set(now[group].map((row) => row.id));
      if (table[group].some((row) => !allowed.has(row.id)))
        throw agentError("agent_context_changed");
    }
    if (seenThrows.size) {
      const ids = new Set((await loadThrows()).map((row) => row.id));
      for (const id of seenThrows) if (!ids.has(id)) throw agentError("agent_context_changed");
    }
    guardTurn(ctx.signal);
  }
  return { context, recheck };
}

async function runTurn(
  ctx: AgentRunContext,
  deps: AgentDependencies,
  message: string,
  usage: AgentUsage,
) {
  const { totalHits, resetTime } = await deps.countTurn(ctx.actor.accountId);
  if (totalHits > 6)
    throw agentError(
      "rate_limited",
      Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now() + 60_000) - Date.now()) / 1000)),
    );
  const { context, recheck } = await scopedReads(ctx, deps, message);
  const registry = [...createAgentReads(context), ...(deps.proposals?.(context) ?? [])];
  const previous = await deps.history.page(ctx, { before: null, limit: 4 });
  const basic = {
    party: context.table.party.map(({ name, id }) => ({ name, id })),
    npcs: context.table.npcs.map(({ id, name, relationship }) => ({ id, name, relationship })),
  };
  // A bare weapon selection completes the immediately preceding clarification.
  // Restate the original command so its actor and target stay in the request.
  const last = previous.turns.at(-1);
  const options = last?.reply.match(/^Which weapon: (.+)\?$/)?.[1];
  const selectsWeapon = options
    ?.split(", ")
    .some((name) => name.toLowerCase() === message.trim().toLowerCase());
  const request = selectsWeapon && last ? last.message + "\nSelected weapon: " + message : message;
  const messages = initialMessages(
    basic,
    previous.turns.map((t) => t.message),
    request,
    last?.reply.slice(0, 1000),
  );
  const answer = await answerTurn(deps.provider, registry, messages, ctx.signal, recheck, usage);
  const turn = { id: randomUUID(), ...answer };
  await deps.history.append(ctx, { id: turn.id, message, reply: turn.reply, tools: turn.tools });
  return turn;
}

/** One backend process owns game and process admission slots. */
export function createAgentRuntime(deps: AgentDependencies): AgentRuntime {
  const active = new Set<string>();
  return {
    available: true,
    busy: (gameId) => active.has(gameId),
    async run(ctx, message) {
      if (active.has(ctx.gameId)) throw agentError("agent_game_busy");
      if (active.size >= 10) throw agentError("agent_busy", 1);
      active.add(ctx.gameId);
      const started = performance.now();
      const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(10_000), deps.shutdown]);
      const usage: AgentUsage = { calls: 0, input: 0, output: 0 };
      let result = "failed";
      let reason: string | undefined;
      try {
        const turn = await beforeDeadline(
          () => runTurn({ ...ctx, signal }, deps, message, usage),
          signal,
        );
        result = "completed";
        return turn;
      } catch (error) {
        if (signal.aborted) {
          result = "agent_timeout";
          throw agentError("agent_timeout");
        }
        const code = (error as { code?: string })?.code;
        if (code === "agent_failed") reason = (error as { reason?: string }).reason;
        if (
          code &&
          [
            "agent_failed",
            "agent_unavailable",
            "rate_limited",
            "agent_context_changed",
            "unauthorized",
            "forbidden",
            "not_found",
          ].includes(code)
        )
          result = code;
        throw error;
      } finally {
        active.delete(ctx.gameId);
        console.info("Agent turn", {
          requestId: ctx.requestId,
          result,
          ...(reason ? { reason } : {}),
          elapsedMs: Math.round(performance.now() - started),
          ...usage,
        });
      }
    },
  };
}
