import { and, eq, inArray, sql } from "drizzle-orm";
import { npcAttacks, npcCreateRequests, npcs } from "../../database/schema.ts";
import { transaction } from "../../database/transaction.ts";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import type { GameAccessFactory, GameActor } from "../games/types.ts";
import type { GameEvents } from "../events/types.ts";
import type { NpcWrite } from "./types.ts";

const fail = (code: string) => Object.assign(new Error(code), { code });
type Row = typeof npcs.$inferSelect;
type AttackRow = typeof npcAttacks.$inferSelect;
type Dependencies = { database: Database; gameAccessFor: GameAccessFactory; events: GameEvents };

function values(npc: NpcWrite) {
  return {
    name: npc.name,
    relationship: npc.relationship,
    level: npc.level,
    visibility: npc.visibility,
    dexDie: npc.baseDice.DEX,
    insDie: npc.baseDice.INS,
    migDie: npc.baseDice.MIG,
    wlpDie: npc.baseDice.WLP,
    currentHp: npc.hp.current,
    maxHp: npc.hp.max,
    currentMp: npc.mp.current,
    maxMp: npc.mp.max,
    defense: npc.defense,
    magicDefense: npc.magicDefense,
    notes: npc.notes,
  };
}
function present(row: Row, attacks: AttackRow[], role: "GM" | "Player") {
  if (role === "Player" && row.visibility === "hidden") return null;
  const visible = { id: row.id, name: row.name, relationship: row.relationship };
  if (role === "Player" && row.visibility === "visible")
    return { view: "visible" as const, ...visible };
  const profile = {
    ...visible,
    level: row.level,
    baseDice: { DEX: row.dexDie, INS: row.insDie, MIG: row.migDie, WLP: row.wlpDie },
    hp: { current: row.currentHp, max: row.maxHp },
    mp: { current: row.currentMp, max: row.maxMp },
    defense: row.defense,
    magicDefense: row.magicDefense,
    attacks: attacks.map((a) => ({
      id: a.id,
      name: a.name,
      reach: a.reach,
      attributes: [a.attribute1, a.attribute2],
      damageBonus: a.damageBonus,
      damageType: a.damageType,
    })),
  };
  if (role === "Player") return { view: "known" as const, ...profile };
  return {
    view: "gm" as const,
    ...profile,
    visibility: row.visibility,
    notes: row.notes,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
async function getRows(tx: DatabaseTransaction, gameId: string, id?: string) {
  const rows = await tx
    .select()
    .from(npcs)
    .where(and(eq(npcs.gameId, gameId), id ? eq(npcs.id, id) : undefined))
    .orderBy(npcs.createdAt, npcs.id);
  const attacks = rows.length
    ? await tx
        .select()
        .from(npcAttacks)
        .where(
          inArray(
            npcAttacks.npcId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(npcAttacks.position)
    : [];
  return rows.map((row) => ({ row, attacks: attacks.filter((attack) => attack.npcId === row.id) }));
}
async function replaceAttacks(tx: DatabaseTransaction, id: string, attacks: NpcWrite["attacks"]) {
  if (attacks.length) {
    // Serialize cross-game claims before checking ownership of attack IDs.
    for (const attackId of attacks.map((attack) => attack.id).sort())
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${attackId}, 0))`);
    const existing = await tx
      .select({ id: npcAttacks.id, npcId: npcAttacks.npcId })
      .from(npcAttacks)
      .where(
        inArray(
          npcAttacks.id,
          attacks.map((attack) => attack.id),
        ),
      );
    if (existing.some((entry) => entry.npcId !== id)) throw fail("validation");
  }
  await tx.delete(npcAttacks).where(eq(npcAttacks.npcId, id));
  if (attacks.length)
    await tx.insert(npcAttacks).values(
      attacks.map((attack, position) => ({
        id: attack.id,
        npcId: id,
        position,
        name: attack.name,
        reach: attack.reach,
        attribute1: attack.attributes[0],
        attribute2: attack.attributes[1],
        damageBonus: attack.damageBonus,
        damageType: attack.damageType,
      })),
    );
}
function sameBody(a: unknown, b: NpcWrite) {
  // JSONB does not preserve key order, so compare normalized objects recursively.
  const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([x], [y]) => x.localeCompare(y)))
        : item,
    );
  return canonical(a) === canonical(b);
}
export function createNpcsService({ database, gameAccessFor, events }: Dependencies) {
  async function read(actor: GameActor, gameId: string, id?: string) {
    return transaction(
      database,
      async (tx) => {
        const access = await gameAccessFor(tx).gameAccess(actor, gameId);
        if (!access) throw fail("not_found");
        const rows = await getRows(tx, gameId, id);
        const result = rows
          .map(({ row, attacks }) => present(row, attacks, access.role))
          .filter((row) => row !== null);
        if (id && !result.length) throw fail("not_found");
        return result;
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async function write(
    actor: GameActor,
    gameId: string,
    id: string,
    npc: NpcWrite,
    expectedRevision?: number,
  ) {
    return transaction(database, async (tx, afterCommit) => {
      const access = await gameAccessFor(tx).lockGame(actor, gameId);
      if (access.role !== "GM") throw fail("forbidden");
      let created = false;
      if (expectedRevision === undefined) {
        const [receipt] = await tx
          .select()
          .from(npcCreateRequests)
          .where(
            and(
              eq(npcCreateRequests.accountId, actor.accountId),
              eq(npcCreateRequests.requestId, id),
            ),
          );
        if (receipt) {
          if (receipt.gameId !== gameId || !sameBody(receipt.requestBody, npc))
            throw fail("id_conflict");
          const [existing] = await getRows(tx, gameId, receipt.npcId);
          if (!existing) throw fail("not_found");
          return { npc: present(existing.row, existing.attacks, "GM"), created };
        }
        const inserted = await tx
          .insert(npcs)
          .values({ id, gameId, ...values(npc) })
          .onConflictDoNothing()
          .returning({ id: npcs.id });
        if (!inserted.length) throw fail("id_conflict");
        await tx.insert(npcCreateRequests).values({
          accountId: actor.accountId,
          requestId: id,
          gameId,
          npcId: id,
          requestBody: npc,
        });
        created = true;
      } else {
        const [current] = await getRows(tx, gameId, id);
        if (!current) throw fail("not_found");
        if (current.row.revision !== expectedRevision) throw fail("stale_revision");
        await tx
          .update(npcs)
          .set({ ...values(npc), revision: expectedRevision + 1, updatedAt: new Date() })
          .where(and(eq(npcs.id, id), eq(npcs.gameId, gameId)));
      }
      await replaceAttacks(tx, id, npc.attacks);
      const [saved] = await getRows(tx, gameId, id);
      afterCommit(() => events.publishGameEvent(gameId, { type: "npcs" }));
      return { npc: present(saved!.row, saved!.attacks, "GM"), created };
    });
  }
  async function remove(actor: GameActor, gameId: string, id: string, expectedRevision: number) {
    return transaction(database, async (tx, afterCommit) => {
      const access = await gameAccessFor(tx).lockGame(actor, gameId);
      if (access.role !== "GM") throw fail("forbidden");
      const [current] = await getRows(tx, gameId, id);
      if (!current) throw fail("not_found");
      if (current.row.revision !== expectedRevision) throw fail("stale_revision");
      await tx.delete(npcs).where(and(eq(npcs.id, id), eq(npcs.gameId, gameId)));
      afterCommit(() => events.publishGameEvent(gameId, { type: "npcs" }));
    });
  }
  return { read, write, remove };
}
