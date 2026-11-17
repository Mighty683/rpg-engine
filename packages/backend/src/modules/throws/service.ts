import type { ThrowReaders, ThrowReaderFactory } from "./types.ts";
import type {
  ThrowRow,
  CreateThrowInput,
  ThrowRecord,
  ResolutionContext,
  RollCharacter,
  SourceThrow,
} from "./types.ts";
import type { DieSource } from "../fabula/types.ts";
import type { GameAccessFactory, GameActor, GameAccess } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";
import { notifyAfterCommit, transaction } from "../../database/transaction.ts";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { agentTurns, throws, throwFields } from "../../database/schema.ts";
// Game Table throw history: immutable roll snapshots with server-assigned per-game
// sequence and authorship-based removal. Every write
// takes the per-game transaction lock before resolving access, so stale selections
// and revoked memberships are re-checked against current state.
import { randomUUID } from "node:crypto";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import { serverDieSource } from "../fabula/rolls.ts";

import { fail, gmActorId } from "./contract.ts";
import { resolveThrow } from "./resolve.ts";
import { resolveNpcThrow } from "./npc-resolve.ts";

const present = (row: ThrowRow, actor: GameActor, access: GameAccess): ThrowRecord => ({
  id: row.id,
  private: row.private,
  createdAt: new Date(row.created_at).toISOString(),
  kind: row.kind,
  role: row.role,
  characterId: row.character_id,
  characterName: row.character_name,
  equipmentId: row.equipment_id,
  equipmentName: row.equipment_name,
  setup: row.setup,
  outcome: row.outcome,
  canRemove: access.role === "GM" || row.author_account_id === actor.accountId,
});

async function readTransaction<T>(
  database: Database,
  operation: (tx: DatabaseTransaction) => Promise<T>,
) {
  return transaction(database, operation, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

async function loadSource(
  tx: DatabaseTransaction,
  gameId: string,
  throwId: string,
  accountId: string,
): Promise<SourceThrow | null> {
  const [row] = await tx
    .select(throwFields)
    .from(throws)
    .where(
      and(
        eq(throws.gameId, gameId),
        eq(throws.id, throwId),
        eq(throws.deleted, false),
        visibleTo(accountId),
      ),
    );
  if (!row) return null;
  return {
    kind: row.kind,
    setup: row.setup,
    characterId: row.character_id,
    equipmentId: row.equipment_id,
  };
}

const visibleTo = (accountId: string) =>
  or(eq(throws.private, false), eq(throws.authorAccountId, accountId));

/** Ordered history read: exclusive throw ID cursor, ascending result, live rows only. */
export async function listThrows(
  { gameAccessFor, database }: { gameAccessFor: GameAccessFactory; database: Database },
  actor: GameActor,
  gameId: string,
  before: string | null,
  limit: number,
) {
  return readTransaction(database, async (tx) => {
    const access = await lockGameRead(gameAccessFor, tx, actor, gameId);
    const [anchor] = before
      ? await tx
          .select({ seq: throws.seq })
          .from(throws)
          .where(and(eq(throws.gameId, gameId), eq(throws.id, before), visibleTo(actor.accountId)))
      : [];
    if (before && !anchor) throw fail("not_found");
    const result = await tx
      .select(throwFields)
      .from(throws)
      .where(
        and(
          eq(throws.gameId, gameId),
          eq(throws.deleted, false),
          visibleTo(actor.accountId),
          anchor ? lt(throws.seq, anchor.seq) : undefined,
        ),
      )
      .orderBy(desc(throws.seq))
      .limit(limit);
    return { throws: result.reverse().map((row) => present(row, actor, access)) };
  });
}

async function lockGameRead(
  gameAccessFor: GameAccessFactory,
  tx: DatabaseTransaction,
  actor: GameActor,
  gameId: string,
) {
  const access = await gameAccessFor(tx).gameAccess(actor, gameId);
  if (!access) throw fail("not_found");
  return access;
}

export async function createThrow(
  {
    gameAccessFor,
    events,
    database,
    readersFor,
  }: {
    gameAccessFor: GameAccessFactory;
    events: GameEvents;
    database: Database;
    readersFor: ThrowReaderFactory;
  },
  actor: GameActor,
  gameId: string,
  input: CreateThrowInput,
  dieSource: DieSource = serverDieSource,
) {
  const result = await transaction(database, async (tx) => {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (input.agentTurnId) {
      if (access.role !== "GM") throw fail("forbidden");
      const [turn] = await tx
        .select({ tools: agentTurns.tools })
        .from(agentTurns)
        .where(
          and(
            eq(agentTurns.id, input.agentTurnId),
            eq(agentTurns.gameId, gameId),
            eq(agentTurns.gmAccountId, actor.accountId),
          ),
        );
      if (!turn?.tools.some((tool) => tool.tool === "prepare_throw")) throw fail("not_found");
      const [existing] = await tx
        .select({ ...throwFields, deleted: throws.deleted })
        .from(throws)
        .where(
          and(
            eq(throws.agentTurnId, input.agentTurnId),
            eq(throws.gameId, gameId),
            eq(throws.authorAccountId, actor.accountId),
          ),
        );
      if (existing?.deleted) throw fail("not_found");
      if (existing) return { record: present(existing, actor, access), created: false };
    }
    const setup = input.setup;
    const readers = readersFor(tx);
    const resolved =
      setup.type === "npc-attribute" || setup.type === "npc-attack"
        ? await resolveNpcThrow(
            tx,
            readers.npcs,
            gameId,
            access,
            setup,
            input.sourceThrowId,
            dieSource,
            actor.accountId,
          )
        : await resolveStandardThrow(
            tx,
            readers,
            gameId,
            access,
            input,
            dieSource,
            actor.accountId,
          );
    const [sequence] = await tx
      .select({ next: sql<string>`COALESCE(MAX(${throws.seq}),0)+1` })
      .from(throws)
      .where(eq(throws.gameId, gameId));
    const id = randomUUID();
    const [inserted] = await tx
      .insert(throws)
      .values({
        id,
        gameId,
        agentTurnId: input.agentTurnId,
        seq: Number(sequence!.next),
        authorAccountId: actor.accountId,
        private: input.private ?? false,
        role: resolved.role,
        characterId: resolved.characterId,
        equipmentId: resolved.equipmentId,
        characterName: resolved.characterName,
        equipmentName: resolved.equipmentName,
        kind: resolved.kind,
        setup: resolved.setup,
        outcome: resolved.outcome,
      })
      .returning(throwFields);
    return { record: present(inserted!, actor, access), created: true };
  });
  if (result.created)
    await notifyAfterCommit(() =>
      events.publishGameEvent(
        gameId,
        { type: "throws" },
        input.private ? actor.accountId : undefined,
      ),
    );
  return result;
}

async function resolveStandardThrow(
  tx: DatabaseTransaction,
  readers: ThrowReaders,
  gameId: string,
  access: GameAccess,
  input: CreateThrowInput,
  dieSource: DieSource,
  accountId: string,
) {
  const setup = input.setup;
  if (setup.type === "free" && setup.characterId !== gmActorId) {
    const npc = await readers.npcs.profile(gameId, setup.characterId);
    if (npc) {
      if (access.role !== "GM") throw fail("forbidden");
      const gmInput = { ...input, setup: { ...setup, characterId: gmActorId } };
      const resolved = resolveThrow(
        gmInput,
        await buildContext(tx, readers, gameId, access, gmInput, accountId),
        dieSource,
      );
      return { ...resolved, characterName: npc.name, setup: { ...resolved.setup, npcId: npc.id } };
    }
  }
  return resolveThrow(
    input,
    await buildContext(tx, readers, gameId, access, input, accountId),
    dieSource,
  );
}

async function buildContext(
  tx: DatabaseTransaction,
  readers: ThrowReaders,
  gameId: string,
  access: GameAccess,
  input: CreateThrowInput,
  accountId: string,
): Promise<ResolutionContext> {
  const active = await readers.characters.activeIds(gameId);
  const ownActive =
    access.role === "Player"
      ? await readers.characters.ownActiveId(gameId, access.membershipId)
      : null;
  const setup = input.setup;
  if (setup.type === "npc-attribute" || setup.type === "npc-attack") throw fail("validation");
  const characterId =
    setup.type === "free" && setup.characterId === gmActorId ? null : setup.characterId;
  const character = characterId ? await readers.characters.load(gameId, characterId) : null;
  const weapon =
    setup.type === "weapon" && character
      ? ((character.sheet.equipment.find(
          (entry) => entry.id === setup.equipmentId && entry.kind === "weapon",
        ) as
          | Extract<RollCharacter["sheet"]["equipment"][number], { kind: "weapon" }>
          | undefined) ?? null)
      : null;
  const source = input.sourceThrowId
    ? await loadSource(tx, gameId, input.sourceThrowId, accountId)
    : null;
  if (input.sourceThrowId && !source) throw fail("not_found");
  return {
    role: access.role,
    membershipId: access.membershipId,
    activeCharacterIds: active,
    ownActiveCharacterId: ownActive,
    character,
    weapon,
    source,
  };
}

/** Marks a history entry deleted; authorship follows the account even after reassignment. */
export async function removeThrow(
  {
    gameAccessFor,
    events,
    database,
  }: { gameAccessFor: GameAccessFactory; events: GameEvents; database: Database },
  actor: GameActor,
  gameId: string,
  throwId: string,
) {
  const result = await transaction(database, async (tx) => {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    const [row] = await tx
      .select(throwFields)
      .from(throws)
      .where(and(eq(throws.gameId, gameId), eq(throws.id, throwId)))
      .for("update");
    if (!row || (row.private && row.author_account_id !== actor.accountId)) throw fail("not_found");
    if (row.deleted) return { deleted: true, changed: false };
    if (access.role !== "GM" && row.author_account_id !== actor.accountId) throw fail("forbidden");
    await tx.update(throws).set({ deleted: true }).where(eq(throws.id, throwId));
    return { deleted: true, changed: true, private: row.private, author: row.author_account_id };
  });
  if (result.changed)
    await notifyAfterCommit(() =>
      events.publishGameEvent(
        gameId,
        { type: "throws" },
        result.private ? result.author : undefined,
      ),
    );
  return result;
}
