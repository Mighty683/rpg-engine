import { and, desc, eq, gt, lt } from "drizzle-orm";
import { accounts, agentTurns, sessions, throws } from "../../database/schema.ts";
import type { Database } from "../../database/types.ts";
import type { GameAccess, GameAccessFactory } from "../games/types.ts";
import { compileSchema } from "../../shared/validation/parse.ts";
import { agentToolsSchema } from "./schema.ts";
import type { AgentHistory, AgentContext } from "./types.ts";

export function requireAgentGm(access: GameAccess | null) {
  if (!access) throw Object.assign(new Error("Game not found."), { code: "not_found" });
  if (access.role !== "GM")
    throw Object.assign(new Error("GM access required."), { code: "forbidden" });
}
function scope({ actor, gameId }: AgentContext) {
  return and(eq(agentTurns.gameId, gameId), eq(agentTurns.gmAccountId, actor.accountId));
}
const fields = {
  id: agentTurns.id,
  author: agentTurns.author,
  message: agentTurns.message,
  reply: agentTurns.reply,
  tools: agentTurns.tools,
};
const validTools = compileSchema(agentToolsSchema);
export function createAgentHistory(
  database: Database,
  gameAccessFor: GameAccessFactory,
): AgentHistory {
  return {
    page(context, { before, limit }) {
      return database.transaction(
        async (tx) => {
          requireAgentGm(await gameAccessFor(tx).gameAccess(context.actor, context.gameId));
          let beforeSequence: bigint | undefined;
          if (before) {
            const [anchor] = await tx
              .select({ sequence: agentTurns.sequence })
              .from(agentTurns)
              .where(and(scope(context), eq(agentTurns.id, before)));
            if (!anchor) throw Object.assign(new Error("Turn unavailable."), { code: "not_found" });
            beforeSequence = anchor.sequence;
          }
          const rows = await tx
            .select({
              ...fields,
              roll: {
                characterName: throws.characterName,
                equipmentName: throws.equipmentName,
                private: throws.private,
                outcome: throws.outcome,
              },
            })
            .from(agentTurns)
            .leftJoin(
              throws,
              and(
                eq(throws.agentTurnId, agentTurns.id),
                eq(throws.gameId, context.gameId),
                eq(throws.authorAccountId, context.actor.accountId),
                eq(throws.deleted, false),
              ),
            )
            .where(
              and(
                scope(context),
                beforeSequence !== undefined ? lt(agentTurns.sequence, beforeSequence) : undefined,
              ),
            )
            .orderBy(desc(agentTurns.sequence))
            .limit(limit + 1);
          const turns = rows
            .slice(0, limit)
            .reverse()
            .map(({ roll, ...turn }) => (roll ? { ...turn, roll } : turn));
          return { turns, nextBefore: rows.length > limit ? turns[0]!.id : null };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async append(context, turn) {
      if (!validTools(turn.tools)) throw new Error("Invalid Agent tool summary.");
      await database.transaction(async (tx) => {
        requireAgentGm(await gameAccessFor(tx).lockGame(context.actor, context.gameId));
        const [account] = await tx
          .select({ author: accounts.username })
          .from(sessions)
          .innerJoin(accounts, eq(sessions.accountId, accounts.id))
          .where(
            and(
              eq(sessions.id, context.actor.sessionId),
              eq(accounts.id, context.actor.accountId),
              gt(sessions.expiresAt, new Date()),
            ),
          );
        if (!account) throw Object.assign(new Error("Session expired."), { code: "unauthorized" });
        context.signal?.throwIfAborted();
        await tx.insert(agentTurns).values({
          id: turn.id,
          gameId: context.gameId,
          gmAccountId: context.actor.accountId,
          author: account.author,
          message: turn.message,
          tools: turn.tools,
          reply: turn.reply,
        });
        context.signal?.throwIfAborted();
      });
    },
  };
}
