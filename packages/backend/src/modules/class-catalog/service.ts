import { randomUUID } from "node:crypto";
import { transaction } from "../../database/transaction.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { GameActor } from "../games/types.ts";
import {
  catalogFailure,
  claimCreate,
  insertGameClass,
  insertTemplate,
  listTemplates,
  readGameClasses,
  readTemplate,
  requireRevision,
  updateTemplate,
} from "./repository.ts";
import type {
  CatalogDependencies,
  ClassBenefit,
  ClassCatalogService,
  ClassDefinition,
  StoredClass,
} from "./types.ts";

function snapshot(definition: ClassDefinition): ClassDefinition {
  const copyBenefit = (benefit: ClassBenefit) => ({ ...benefit, id: randomUUID() });
  return {
    ...definition,
    freeBenefits: definition.freeBenefits.map(copyBenefit),
    skills: definition.skills.map((skill) => ({
      ...skill,
      id: randomUUID(),
      benefits: skill.benefits.map(copyBenefit),
    })),
  };
}

function replay(record: StoredClass | undefined) {
  if (!record) catalogFailure("id_conflict");
  return { record, created: false };
}

export function createClassCatalogService({
  database,
  gameAccessFor,
  events,
}: CatalogDependencies): ClassCatalogService {
  async function lockGm(tx: DatabaseTransaction, actor: GameActor, gameId: string) {
    const access = await gameAccessFor(tx).lockGame(actor, gameId);
    if (access.role !== "GM") catalogFailure("forbidden");
  }

  return {
    listTemplates: (actor) => listTemplates(database, actor.accountId),
    createTemplate: (actor, input) =>
      transaction(database, async (tx) => {
        const { accountId } = actor;
        if (!(await claimCreate(tx, accountId, input.id, { kind: "create", ...input })))
          return replay(await readTemplate(tx, accountId, input.id));
        const record = await insertTemplate(tx, accountId, { ...input, revision: 0 });
        return { record, created: true };
      }),
    updateTemplate: (actor, id, input) =>
      transaction(database, (tx) =>
        updateTemplate(tx, actor.accountId, id, input.expectedRevision, input.definition),
      ),
    listGameClasses: (actor, gameId) =>
      transaction(
        database,
        async (tx) => {
          if (!(await gameAccessFor(tx).gameAccess(actor, gameId))) catalogFailure("not_found");
          return readGameClasses(tx, gameId);
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      ),
    copyClass: (actor, gameId, input) =>
      transaction(database, async (tx, afterCommit) => {
        await lockGm(tx, actor, gameId);
        if (!(await claimCreate(tx, actor.accountId, input.id, { kind: "copy", gameId, ...input })))
          return replay((await readGameClasses(tx, gameId, input.id))[0]);
        const source = await readTemplate(tx, actor.accountId, input.templateId);
        if (!source) catalogFailure("not_found");
        requireRevision(source, input.expectedTemplateRevision);
        const record = await insertGameClass(tx, gameId, {
          id: input.id,
          systemId: source.systemId,
          revision: 0,
          definition: snapshot(source.definition),
        });
        afterCommit(() => events.publishGameEvent(gameId, { type: "roster" }));
        return { record, created: true };
      }),
    saveToLibrary: (actor, gameId, id, input) =>
      transaction(database, async (tx) => {
        await lockGm(tx, actor, gameId);
        const { accountId } = actor;
        const { target } = input;
        if (
          target.mode === "new" &&
          !(await claimCreate(tx, accountId, target.id, { kind: "save", gameId, id, ...input }))
        )
          return replay(await readTemplate(tx, accountId, target.id));
        const [source] = await readGameClasses(tx, gameId, id);
        if (!source) catalogFailure("not_found");
        requireRevision(source, input.expectedRevision);
        const definition = snapshot(source.definition);
        if (target.mode === "update") {
          const record = await updateTemplate(
            tx,
            accountId,
            target.templateId,
            target.expectedTemplateRevision,
            definition,
          );
          return { record, created: false };
        }
        const record = await insertTemplate(tx, accountId, {
          id: target.id,
          systemId: source.systemId,
          revision: 0,
          definition: { ...definition, name: target.name },
        });
        return { record, created: true };
      }),
  };
}
