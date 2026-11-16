import type { MembershipOwnershipFactory } from "../players/types.ts";
import type { FabulaSheet } from "../fabula/types.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";
import { transaction } from "../../database/transaction.ts";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  characters,
  characterCreateRequests,
  characterClasses,
  characterSkills,
  characterEquipment,
  characterFields,
} from "../../database/schema.ts";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import { defaultSheet, mergeSheet } from "../fabula/rules.ts";

import { loadWorkspaceRecord, present, sheetSequential } from "./service.ts";
import { canEditCharacter } from "./access.ts";
import { characterSummaries, summary } from "./ownership.ts";
import { equipmentToRow } from "./mapping.ts";
import {
  applyProgression,
  managedAllocations,
  progressionFor,
  replaceManagedAllocation,
} from "./progression.ts";
import type { CharacterChanges } from "./types.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });

async function requireReadAccess(
  gameAccessFor: GameAccessFactory,
  tx: DatabaseTransaction,
  actor: GameActor,
  gameId: string,
) {
  const access = await gameAccessFor(tx).gameAccess(actor, gameId);
  if (!access) throw fail("not_found");
  return access;
}

export async function listWorkspaceCharacters(
  { gameAccessFor, database }: { gameAccessFor: GameAccessFactory; database: Database },
  actor: GameActor,
  gameId: string,
) {
  return transaction(
    database,
    async (tx) => {
      const access = await requireReadAccess(gameAccessFor, tx, actor, gameId);
      const result = await characterSummaries(tx, gameId);
      return result.map((item) => summary(item, access));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function getWorkspaceCharacter(
  { gameAccessFor, database }: { gameAccessFor: GameAccessFactory; database: Database },
  actor: GameActor,
  gameId: string,
  id: string,
) {
  return transaction(
    database,
    async (tx) => {
      const access = await requireReadAccess(gameAccessFor, tx, actor, gameId);
      const result = {
        rows: await tx
          .select(characterFields)
          .from(characters)
          .where(and(eq(characters.gameId, gameId), eq(characters.id, id))),
      };
      const character = result.rows[0];
      if (!character) throw fail("not_found");
      return loadWorkspaceRecord(tx, character, canEditCharacter(access, character.player_id));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function createWorkspaceCharacter(
  {
    gameAccessFor,
    events,
    database,
    membershipsFor,
  }: {
    gameAccessFor: GameAccessFactory;
    events: GameEvents;
    database: Database;
    membershipsFor: MembershipOwnershipFactory;
  },
  actor: GameActor,
  gameId: string,
  id: string,
  name: string,
) {
  return transaction(database, async (tx, afterCommit) => {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    const sheet = defaultSheet(name);
    const receipt = await tx
      .select({
        game_id: characterCreateRequests.gameId,
        character_id: characterCreateRequests.characterId,
        name: characterCreateRequests.name,
      })
      .from(characterCreateRequests)
      .where(
        and(
          eq(characterCreateRequests.accountId, actor.accountId),
          eq(characterCreateRequests.requestId, id),
        ),
      );
    if (receipt[0]) {
      const prior = receipt[0];
      if (prior.game_id !== gameId || prior.name !== sheet.name) throw fail("id_conflict");
      const existing = {
        rows: await tx
          .select(characterFields)
          .from(characters)
          .where(and(eq(characters.gameId, gameId), eq(characters.id, prior.character_id))),
      };
      if (!existing.rows[0]) throw fail("not_found");
      if (!canEditCharacter(access, existing.rows[0].player_id)) throw fail("forbidden");
      const record = await loadWorkspaceRecord(tx, existing.rows[0], true);
      return { record, created: false };
    }
    const inserted = await tx
      .insert(characters)
      .values({
        id,
        gameId,
        playerId: access.membershipId,
        name: sheet.name,
        theme: sheet.theme,
        level: sheet.level,
        dexDie: sheet.baseDice.DEX,
        insDie: sheet.baseDice.INS,
        migDie: sheet.baseDice.MIG,
        wlpDie: sheet.baseDice.WLP,
        currentHp: sheet.resources.hp,
        currentMp: sheet.resources.mp,
        currentIp: sheet.resources.ip,
        fabulaPoints: sheet.resources.fabula,
      })
      .onConflictDoNothing({ target: characters.id })
      .returning(characterFields);
    if (!inserted[0]) throw fail("id_conflict");
    await tx.insert(characterCreateRequests).values({
      accountId: actor.accountId,
      requestId: id,
      gameId,
      characterId: id,
      name: sheet.name,
    });
    if (access.role === "Player")
      await membershipsFor(tx).select(gameId, access.membershipId!, id, true);
    afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
    return { record: present(inserted[0], sheet, true), created: true };
  });
}

export async function setGmCharacterActive(
  {
    gameAccessFor,
    events,
    database,
  }: { gameAccessFor: GameAccessFactory; events: GameEvents; database: Database },
  actor: GameActor,
  gameId: string,
  id: string,
  active: boolean,
) {
  return transaction(database, async (tx, afterCommit) => {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (access.role !== "GM") throw fail("forbidden");
    const changed = await tx
      .update(characters)
      .set({ gmActive: active })
      .where(and(eq(characters.gameId, gameId), eq(characters.id, id), isNull(characters.playerId)))
      .returning({ id: characters.id });
    if (!changed.length) {
      const existing = await tx
        .select({ id: characters.id })
        .from(characters)
        .where(and(eq(characters.gameId, gameId), eq(characters.id, id)));
      throw fail(existing.length ? "forbidden" : "not_found");
    }
    const result = await characterSummaries(tx, gameId, id);
    afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
    return summary(result[0]!, access);
  });
}

async function replaceNamedEntries(
  tx: DatabaseTransaction,
  table: typeof characterClasses | typeof characterSkills,
  characterId: string,
  entries: FabulaSheet["classes"],
) {
  await tx.delete(table).where(eq(table.characterId, characterId));
  for (const [index, entry] of entries.entries())
    await tx.insert(table).values({
      id: entry.id,
      name: entry.name,
      notes: entry.notes,
      characterId,
      position: index + 1,
    });
}

export async function updateWorkspaceCharacter(
  {
    gameAccessFor,
    events,
    database,
  }: { gameAccessFor: GameAccessFactory; events: GameEvents; database: Database },
  gameId: string,
  actor: GameActor,
  id: string,
  expected: number,
  changes: CharacterChanges,
) {
  return transaction(database, async (c, afterCommit) => {
    const access = await gameAccessFor(c).lockGame(actor, gameId);
    const found = {
      rows: await c
        .select(characterFields)
        .from(characters)
        .where(and(eq(characters.gameId, gameId), eq(characters.id, id)))
        .for("update"),
    };
    const r = found.rows[0];
    if (!r) throw fail("not_found");
    if (!canEditCharacter(access, r.player_id)) throw fail("forbidden");
    if (r.revision !== expected) throw fail("stale_revision");
    const current = await sheetSequential(c, r);
    const { progression: progressionChanges, ...sheetChanges } = changes;
    const s =
      progressionChanges && !Object.keys(sheetChanges).length
        ? current
        : mergeSheet(current, sheetChanges);
    const previous = (await managedAllocations(c, [r.id])).get(r.id);
    const before = progressionFor(r, previous);
    const updated = progressionChanges
      ? await applyProgression(c, gameId, r.id, before, progressionChanges)
      : { progression: before, allocation: previous };
    const { current: expCurrent, total: expTotal } = updated.progression.experience;
    const allocationsChanged =
      JSON.stringify(before.classLevels) !== JSON.stringify(updated.progression.classLevels) ||
      JSON.stringify(before.skillRanks) !== JSON.stringify(updated.progression.skillRanks);
    if (
      !allocationsChanged &&
      r.exp_current === expCurrent &&
      r.exp_total === expTotal &&
      JSON.stringify(s) === JSON.stringify(current)
    ) {
      return present(r, current, true, previous);
    }
    if (allocationsChanged && updated.allocation)
      await replaceManagedAllocation(c, gameId, r.id, updated.allocation);
    const [persisted] = await c
      .update(characters)
      .set({
        name: s.name,
        theme: s.theme,
        level: s.level,
        dexDie: s.baseDice.DEX,
        insDie: s.baseDice.INS,
        migDie: s.baseDice.MIG,
        wlpDie: s.baseDice.WLP,
        expCurrent,
        expTotal,
        currentHp: s.resources.hp,
        currentMp: s.resources.mp,
        currentIp: s.resources.ip,
        fabulaPoints: s.resources.fabula,
        maxHpOverride: s.overrides.maxHp,
        maxMpOverride: s.overrides.maxMp,
        maxIpOverride: s.overrides.maxIp,
        defenseOverride: s.overrides.defense,
        magicDefenseOverride: s.overrides.magicDefense,
        initiativeOverride: s.overrides.initiative,
        revision: sql`${characters.revision}+1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(characters.id, id),
          eq(characters.gameId, gameId),
          eq(characters.revision, expected),
        ),
      )
      .returning(characterFields);
    if ("classes" in changes) await replaceNamedEntries(c, characterClasses, id, s.classes);
    if ("skills" in changes) await replaceNamedEntries(c, characterSkills, id, s.skills);
    if ("equipment" in changes) {
      await c.delete(characterEquipment).where(eq(characterEquipment.characterId, id));
      for (const [index, entry] of s.equipment.entries())
        await c.insert(characterEquipment).values(equipmentToRow(id, index + 1, entry));
    }
    const out = present(persisted!, s, true, updated.allocation);
    afterCommit(() => events.publishGameEvent(gameId, { type: "sheet", characterId: r.id }));
    afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
    return out;
  });
}

/** Permanently deletes a sheet while preserving its create-request receipt. */
export async function deleteWorkspaceCharacter(
  {
    gameAccessFor,
    events,
    database,
    membershipsFor,
  }: {
    gameAccessFor: GameAccessFactory;
    events: GameEvents;
    database: Database;
    membershipsFor: MembershipOwnershipFactory;
  },
  actor: GameActor,
  gameId: string,
  id: string,
) {
  return transaction(database, async (tx, afterCommit) => {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    const existing = {
      rows: await tx
        .select(characterFields)
        .from(characters)
        .where(and(eq(characters.gameId, gameId), eq(characters.id, id)))
        .for("update"),
    };
    const character = existing.rows[0];
    if (!character) throw fail("not_found");
    if (!canEditCharacter(access, character.player_id)) throw fail("forbidden");
    await membershipsFor(tx).clearCharacter(gameId, id);
    await tx.delete(characters).where(and(eq(characters.gameId, gameId), eq(characters.id, id)));
    afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
  });
}
