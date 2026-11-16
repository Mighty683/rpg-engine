import { and, eq, inArray } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import {
  classCreateRequests,
  classTemplates,
  gameClasses,
  gameClassSkills,
} from "../../database/schema.ts";
import type { Database, DatabaseTransaction } from "../../database/types.ts";
import type { ClassDefinition, ClassSkill, GameClassStore, StoredClass } from "./types.ts";

export function catalogFailure(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function requireRevision(record: StoredClass, expected: number) {
  if (record.revision !== expected) catalogFailure("stale_revision");
}

export function listTemplates(db: Database, accountId: string): Promise<StoredClass[]> {
  return db
    .select({
      id: classTemplates.id,
      revision: classTemplates.revision,
      systemId: classTemplates.systemId,
      definition: classTemplates.definition,
    })
    .from(classTemplates)
    .where(eq(classTemplates.accountId, accountId))
    .orderBy(classTemplates.id);
}

export async function readTemplate(
  tx: DatabaseTransaction,
  accountId: string,
  id: string,
): Promise<StoredClass | undefined> {
  const [record] = await tx
    .select()
    .from(classTemplates)
    .where(and(eq(classTemplates.id, id), eq(classTemplates.accountId, accountId)))
    .for("update");
  if (!record) return;
  const { revision, systemId, definition } = record;
  return { id: record.id, systemId, revision, definition };
}

export async function updateTemplate(
  tx: DatabaseTransaction,
  accountId: string,
  id: string,
  expected: number,
  definition: ClassDefinition,
): Promise<StoredClass> {
  const template = await readTemplate(tx, accountId, id);
  if (!template) catalogFailure("not_found");
  requireRevision(template, expected);
  const revision = template.revision + 1;
  await tx
    .update(classTemplates)
    .set({ definition, revision })
    .where(and(eq(classTemplates.id, id), eq(classTemplates.accountId, accountId)));
  return { ...template, revision, definition };
}

export async function insertTemplate(
  tx: DatabaseTransaction,
  accountId: string,
  record: StoredClass,
) {
  const [result] = await tx
    .insert(classTemplates)
    .values({ accountId, ...record })
    .onConflictDoNothing()
    .returning({ id: classTemplates.id });
  if (!result) catalogFailure("id_conflict");
  return record;
}

export async function readGameClasses(
  tx: DatabaseTransaction,
  gameId: string,
  classId?: string,
): Promise<StoredClass[]> {
  const rows = await tx
    .select()
    .from(gameClasses)
    .where(and(eq(gameClasses.gameId, gameId), classId ? eq(gameClasses.id, classId) : undefined))
    .orderBy(gameClasses.id);
  if (!rows.length) return [];
  const skills = await tx
    .select()
    .from(gameClassSkills)
    .where(
      and(
        eq(gameClassSkills.gameId, gameId),
        classId ? eq(gameClassSkills.gameClassId, classId) : undefined,
      ),
    )
    .orderBy(gameClassSkills.position);
  const byClass = new Map<string, ClassSkill[]>();
  for (const { gameClassId, id, name, description, maxRank, benefits } of skills) {
    const group = byClass.get(gameClassId) ?? [];
    group.push({ id, name, description, maxRank, benefits });
    byClass.set(gameClassId, group);
  }
  return rows.map(({ id, revision, systemId, name, description, freeBenefits }) => ({
    id,
    revision,
    systemId,
    definition: { name, description, freeBenefits, skills: byClass.get(id) ?? [] },
  }));
}

export async function insertGameClass(
  tx: DatabaseTransaction,
  gameId: string,
  record: StoredClass,
) {
  const {
    definition: { skills, ...metadata },
    ...identity
  } = record;
  const [result] = await tx
    .insert(gameClasses)
    .values({ gameId, ...identity, ...metadata })
    .onConflictDoNothing()
    .returning({ id: gameClasses.id });
  if (!result) catalogFailure("id_conflict");
  if (skills.length)
    await tx
      .insert(gameClassSkills)
      .values(
        skills.map((skill, position) => ({ ...skill, position, gameId, gameClassId: record.id })),
      );
  return record;
}

/** The unique receipt serializes retries across transactions, including different target games. */
export async function claimCreate(
  tx: DatabaseTransaction,
  accountId: string,
  requestId: string,
  intent: Record<string, unknown>,
) {
  const [inserted] = await tx
    .insert(classCreateRequests)
    .values({ accountId, requestId, intent })
    .onConflictDoNothing()
    .returning({ id: classCreateRequests.requestId });
  if (inserted) return true;
  const [existing] = await tx
    .select({ intent: classCreateRequests.intent })
    .from(classCreateRequests)
    .where(
      and(
        eq(classCreateRequests.accountId, accountId),
        eq(classCreateRequests.requestId, requestId),
      ),
    );
  // Serialize the normalized input to its actual JSON representation before comparing with JSONB.
  if (!existing || !isDeepStrictEqual(existing.intent, JSON.parse(JSON.stringify(intent))))
    catalogFailure("id_conflict");
  return false;
}

export function createGameClassStore(tx: DatabaseTransaction): GameClassStore {
  const classScope = (gameId: string, id: string) =>
    and(eq(gameClasses.gameId, gameId), eq(gameClasses.id, id));
  return {
    async read(gameId, id) {
      return (await readGameClasses(tx, gameId, id))[0];
    },
    async replace(gameId, existing, definition) {
      const id = existing.id;
      const revision = existing.revision + 1;
      const { skills, ...metadata } = definition;
      const previousIds = new Set(existing.definition.skills.map((skill) => skill.id));
      const nextIds = new Set(skills.map((skill) => skill.id));
      const removed = [...previousIds].filter((skillId) => !nextIds.has(skillId));
      const scope = and(eq(gameClassSkills.gameId, gameId), eq(gameClassSkills.gameClassId, id));
      if (removed.length)
        await tx.delete(gameClassSkills).where(and(scope, inArray(gameClassSkills.id, removed)));
      for (const [position, skill] of skills.entries()) {
        const { id: skillId, ...fields } = skill;
        if (previousIds.has(skillId)) {
          await tx
            .update(gameClassSkills)
            .set({ ...fields, position })
            .where(and(scope, eq(gameClassSkills.id, skillId)));
          continue;
        }
        const [inserted] = await tx
          .insert(gameClassSkills)
          .values({ ...skill, position, gameId, gameClassId: id })
          .onConflictDoNothing()
          .returning({ id: gameClassSkills.id });
        if (!inserted) catalogFailure("skill_id_unavailable");
      }
      await tx
        .update(gameClasses)
        .set({ ...metadata, revision })
        .where(classScope(gameId, id));
      return { ...existing, revision, definition };
    },
    async remove(gameId, id) {
      await tx.delete(gameClasses).where(classScope(gameId, id));
    },
  };
}
