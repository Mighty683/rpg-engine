import { notifyAfterCommit, transaction } from "../../database/transaction.ts";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  activeCharacterCondition,
  characters,
  characterFields,
  players,
  throws,
  throwFields,
} from "../../database/schema.ts";
// Game Table throw history: immutable roll snapshots with server-assigned per-game
// sequence and authorship-based removal. Every write
// takes the per-game transaction lock before resolving access, so stale selections
// and revoked memberships are re-checked against current state.
import { randomUUID } from "node:crypto";
import type { Database, DatabaseTransaction } from "../../database/client.ts";
import { serverDieSource, type DieSource } from "../fabula/rolls.ts";
import { gameAccess, lockGame, type GameActor, type GameAccess } from "../games/service.ts";
import { publishGameEvent } from "../events/streams.ts";
import { sheetSequential } from "../characters/service.ts";
import {
  fail,
  gmActorId,
  type CreateThrowInput,
  type ThrowRecord,
  type ResolvedSetup,
  type OutcomeJson,
  type ThrowKind,
} from "./contract.ts";
import {
  resolveThrow,
  type ResolutionContext,
  type RollCharacter,
  type SourceThrow,
} from "./resolve.ts";

type ThrowRow = {
  id: string;
  game_id: string;
  seq: string | number;
  created_at: Date;
  author_account_id: string;
  role: "GM" | "Player";
  character_id: string | null;
  equipment_id: string | null;
  character_name: string;
  equipment_name: string | null;
  kind: ThrowKind;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
  deleted: boolean;
};

const present = (row: ThrowRow, actor: GameActor, access: GameAccess): ThrowRecord => ({
  id: row.id,
  seq: Number(row.seq),
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

async function activeCharacterIds(tx: DatabaseTransaction, gameId: string) {
  const result = await tx
    .select({ id: characters.id })
    .from(characters)
    .leftJoin(
      players,
      and(eq(players.id, characters.playerId), eq(players.gameId, characters.gameId)),
    )
    .where(and(eq(characters.gameId, gameId), activeCharacterCondition()));
  return result.map((row) => row.id);
}

async function ownActiveCharacterId(tx: DatabaseTransaction, gameId: string, membershipId: string) {
  const [result] = await tx
    .select({ activeCharacterId: players.activeCharacterId })
    .from(players)
    .where(
      and(eq(players.id, membershipId), eq(players.gameId, gameId), eq(players.removed, false)),
    );
  return result?.activeCharacterId ?? null;
}

async function loadCharacter(
  tx: DatabaseTransaction,
  gameId: string,
  characterId: string,
): Promise<RollCharacter | null> {
  const [row] = await tx
    .select(characterFields)
    .from(characters)
    .where(and(eq(characters.gameId, gameId), eq(characters.id, characterId)));
  if (!row) return null;
  const sheet = await sheetSequential(tx, row);
  return { id: row.id, playerId: row.player_id, revision: row.revision, name: sheet.name, sheet };
}

async function loadSource(
  tx: DatabaseTransaction,
  gameId: string,
  throwId: string,
): Promise<SourceThrow | null> {
  const [row] = await tx
    .select(throwFields)
    .from(throws)
    .where(and(eq(throws.gameId, gameId), eq(throws.id, throwId), eq(throws.deleted, false)));
  if (!row) return null;
  return {
    kind: row.kind,
    setup: row.setup,
    characterId: row.character_id,
    equipmentId: row.equipment_id,
  };
}

/** Ordered history read: exclusive sequence cursor, ascending result, live rows only. */
export async function listThrows(
  database: Database,
  actor: GameActor,
  gameId: string,
  before: number | null,
  limit: number,
) {
  return readTransaction(database, async (tx) => {
    const access = await lockGameRead(tx, actor, gameId);
    const result = await tx
      .select(throwFields)
      .from(throws)
      .where(
        and(
          eq(throws.gameId, gameId),
          eq(throws.deleted, false),
          before === null ? undefined : lt(throws.seq, before),
        ),
      )
      .orderBy(desc(throws.seq))
      .limit(limit);
    return { throws: result.reverse().map((row) => present(row, actor, access)) };
  });
}

async function lockGameRead(tx: DatabaseTransaction, actor: GameActor, gameId: string) {
  const access = await gameAccess(tx, actor, gameId);
  if (!access) throw fail("not_found");
  return access;
}

export async function createThrow(
  database: Database,
  actor: GameActor,
  gameId: string,
  input: CreateThrowInput,
  dieSource: DieSource = serverDieSource,
) {
  const result = await transaction(database, async (tx) => {
    const access = await lockGame(tx, actor, gameId);
    const context = await buildContext(tx, gameId, access, input);
    const resolved = resolveThrow(input, context, dieSource);
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
        seq: Number(sequence!.next),
        authorAccountId: actor.accountId,
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
    return { record: present(inserted!, actor, access) };
  });
  await notifyAfterCommit(() => publishGameEvent(gameId, { type: "throws" }));
  return result;
}

async function buildContext(
  tx: DatabaseTransaction,
  gameId: string,
  access: GameAccess,
  input: CreateThrowInput,
): Promise<ResolutionContext> {
  const active = await activeCharacterIds(tx, gameId);
  const ownActive =
    access.role === "Player" ? await ownActiveCharacterId(tx, gameId, access.membershipId) : null;
  const setup = input.setup;
  const characterId =
    setup.type === "free" && setup.characterId === gmActorId ? null : setup.characterId;
  const character = characterId ? await loadCharacter(tx, gameId, characterId) : null;
  const weapon =
    setup.type === "weapon" && character
      ? ((character.sheet.equipment.find(
          (entry) => entry.id === setup.equipmentId && entry.kind === "weapon",
        ) as
          | Extract<RollCharacter["sheet"]["equipment"][number], { kind: "weapon" }>
          | undefined) ?? null)
      : null;
  const source = input.sourceThrowId ? await loadSource(tx, gameId, input.sourceThrowId) : null;
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
  database: Database,
  actor: GameActor,
  gameId: string,
  throwId: string,
) {
  const result = await transaction(database, async (tx) => {
    const access = await lockGame(tx, actor, gameId);
    const [row] = await tx
      .select(throwFields)
      .from(throws)
      .where(and(eq(throws.gameId, gameId), eq(throws.id, throwId)))
      .for("update");
    if (!row) throw fail("not_found");
    if (row.deleted) return { deleted: true, changed: false };
    if (access.role !== "GM" && row.author_account_id !== actor.accountId) throw fail("forbidden");
    await tx.update(throws).set({ deleted: true }).where(eq(throws.id, throwId));
    return { deleted: true, changed: true };
  });
  if (result.changed) await notifyAfterCommit(() => publishGameEvent(gameId, { type: "throws" }));
  return result;
}
