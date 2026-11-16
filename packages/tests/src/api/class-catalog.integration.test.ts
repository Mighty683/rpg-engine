import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import type {
  ClassDefinition,
  StoredClass,
} from "../../../backend/src/modules/class-catalog/types.ts";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

const library = "/library/class";
const gameCatalog = (gameId: string) => `/games/${gameId}/classes`;
const definition = (name: string): ClassDefinition => ({
  name,
  description: "Keep the party safe.",
  freeBenefits: [{ id: randomUUID(), kind: "modifier", name: "Ward", stat: "maxHp", amount: 5 }],
  skills: [
    {
      id: randomUUID(),
      name: "Deflect",
      description: "",
      maxRank: 3,
      benefits: [{ id: randomUUID(), kind: "text", name: "Guard", description: "Shield an ally." }],
    },
  ],
});
const childIds = (item: ClassDefinition) => [
  ...item.freeBenefits.map(({ id }) => id),
  ...item.skills.flatMap(({ id, benefits }) => [id, ...benefits.map((benefit) => benefit.id)]),
];
function withoutChildIds(item: ClassDefinition) {
  return {
    ...item,
    freeBenefits: item.freeBenefits.map(({ id: _id, ...benefit }) => benefit),
    skills: item.skills.map(({ id: _id, benefits, ...skill }) => ({
      ...skill,
      benefits: benefits.map(({ id: _id, ...benefit }) => benefit),
    })),
  };
}

describe("class catalog API", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("class_catalog", { appOrigin: "https://rpg.example" });
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  async function listTemplates(actor: string) {
    const response = await fixture.request(library, actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { templates: StoredClass[] }).templates;
  }

  async function listClasses(gameId: string, actor: string) {
    const response = await fixture.request(gameCatalog(gameId), actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { classes: StoredClass[] }).classes;
  }

  it("API-01 restricts library ownership and game authority with valid requests", async () => {
    const { request, ids, origin, tokens, pool } = fixture;
    const path = gameCatalog(ids.game);
    const otherPath = gameCatalog(ids.otherGame);
    const create = {
      id: randomUUID(),
      systemId: "fabula-ultima",
      definition: definition("Guardian"),
    };
    const foreign = { ...create, id: randomUUID(), definition: definition("Warden") };
    expect((await request(library, null)).status).toBe(401);
    expect((await request(library, null, "POST", create)).status).toBe(401);
    expect((await request(path, null)).status).toBe(401);
    expect((await request(library, "gm", "POST", create)).status).toBe(201);
    expect((await request(library, "outsider", "POST", foreign)).status).toBe(201);
    const [ownerBefore] = await listTemplates("gm");
    const [foreignBefore] = await listTemplates("outsider");
    expect(await listTemplates("player")).toEqual([]);

    const edit = { expectedRevision: 0, definition: definition("Forged") };
    const editPath = `${library}/${create.id}`;
    expect((await request(editPath, "outsider", "PATCH", edit)).status).toBe(404);
    expect(await listTemplates("gm")).toEqual([ownerBefore]);
    expect((await request(editPath, "gm", "PATCH", edit, "https://wrong.example")).status).toBe(
      403,
    );
    const withoutCsrf = await fetch(`${origin}/api${editPath}`, {
      method: "PATCH",
      headers: {
        origin: "https://rpg.example",
        cookie: `rpg_session=${tokens.gm}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(edit),
    });
    expect(withoutCsrf.status).toBe(403);
    expect((await withoutCsrf.json()).error.code).toBe("invalid_csrf");
    expect(await listTemplates("gm")).toEqual([ownerBefore]);

    const copy = { id: randomUUID(), templateId: create.id, expectedTemplateRevision: 0 };
    expect((await request(path, "player", "POST", copy)).status).toBe(403);
    expect((await request(path, "outsider")).status).toBe(404);
    expect((await request(path, "outsider", "POST", copy)).status).toBe(404);
    expect((await request(path, "gm", "POST", { ...copy, templateId: foreign.id })).status).toBe(
      404,
    );
    expect(await listClasses(ids.game, "gm")).toEqual([]);
    expect((await request(path, "gm", "POST", copy)).status).toBe(201);
    const [savedClass] = await listClasses(ids.game, "gm");
    expect(await listClasses(ids.game, "player")).toEqual([savedClass]);

    const target = { mode: "update", templateId: foreign.id, expectedTemplateRevision: 0 };
    const savePath = `${path}/${copy.id}/save-to-library`;
    expect(
      (await request(savePath, "player", "POST", { expectedRevision: 0, target })).status,
    ).toBe(403);
    expect((await request(savePath, "gm", "POST", { expectedRevision: 0, target })).status).toBe(
      404,
    );
    expect(
      (
        await request(`${otherPath}/${copy.id}/save-to-library`, "outsider", "POST", {
          expectedRevision: 0,
          target,
        })
      ).status,
    ).toBe(404);
    expect(await listTemplates("gm")).toEqual([ownerBefore]);
    expect(await listTemplates("outsider")).toEqual([foreignBefore]);
    expect(await listClasses(ids.game, "gm")).toEqual([savedClass]);
    expect(await listClasses(ids.otherGame, "outsider")).toEqual([]);
    await pool.query("UPDATE players SET removed = true WHERE id = $1", [ids.otherMember]);
    expect((await request(otherPath, "player")).status).toBe(404);
  });

  it("API-02 copies independent definitions and resolves retries from live committed results", async () => {
    const { request, ids, pool } = fixture;
    const path = gameCatalog(ids.game);
    const original = definition("Keeper");
    const create = { id: randomUUID(), systemId: "fabula-ultima", definition: original };
    const createRequests = await Promise.all([
      request(library, "gm", "POST", create),
      request(library, "gm", "POST", create),
    ]);
    expect(createRequests.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 201]);
    expect(await createRequests[0]!.json()).toEqual(await createRequests[1]!.json());

    const copy = { id: randomUUID(), templateId: create.id, expectedTemplateRevision: 0 };
    const secondCopy = { ...copy, id: randomUUID() };
    const duplicateCopies = await Promise.all([
      request(path, "gm", "POST", copy),
      request(path, "gm", "POST", copy),
    ]);
    expect(duplicateCopies.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 201]);
    const { gameClass: first } = (await duplicateCopies[0]!.json()) as { gameClass: StoredClass };
    expect(await duplicateCopies[1]!.json()).toEqual({ gameClass: first });
    const secondResponse = await request(path, "gm", "POST", secondCopy);
    expect(secondResponse.status).toBe(201);
    const { gameClass: second } = (await secondResponse.json()) as { gameClass: StoredClass };
    expect(first.id).toBe(copy.id);
    expect(second.id).toBe(secondCopy.id);
    expect(withoutChildIds(first.definition)).toEqual(withoutChildIds(original));
    expect(withoutChildIds(second.definition)).toEqual(withoutChildIds(original));
    const copiedIds = [original, first.definition, second.definition].flatMap(childIds);
    expect(new Set(copiedIds).size).toBe(copiedIds.length);

    const editPath = `${library}/${create.id}`;
    const edited = { ...original, name: "Library change" };
    expect(
      (await request(editPath, "gm", "PATCH", { expectedRevision: 0, definition: edited })).status,
    ).toBe(200);
    const afterEdit = (await listTemplates("gm")).find(({ id }) => id === create.id);
    expect(afterEdit).toMatchObject({ revision: 1, definition: edited });
    const replay = await request(library, "gm", "POST", create);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ template: afterEdit });
    const copyReplay = await request(gameCatalog(ids.game.toUpperCase()), "gm", "POST", copy);
    expect(copyReplay.status).toBe(200);
    expect(await copyReplay.json()).toEqual({ gameClass: first });
    const staleCopy = await request(path, "gm", "POST", { ...copy, id: randomUUID() });
    expect(staleCopy.status).toBe(409);
    expect((await staleCopy.json()).error.code).toBe("stale_revision");
    const conflicting = await request(path, "gm", "POST", { ...copy, expectedTemplateRevision: 1 });
    expect(conflicting.status).toBe(409);
    expect((await conflicting.json()).error.code).toBe("id_conflict");

    const savePath = `${path}/${first.id}/save-to-library`;
    const update = { mode: "update", templateId: create.id, expectedTemplateRevision: 1 };
    expect(
      (await request(savePath, "gm", "POST", { expectedRevision: 1, target: update })).status,
    ).toBe(409);
    expect(
      (
        await request(savePath, "gm", "POST", {
          expectedRevision: 0,
          target: { ...update, expectedTemplateRevision: 0 },
        })
      ).status,
    ).toBe(409);
    expect((await listTemplates("gm")).find(({ id }) => id === create.id)).toEqual(afterEdit);
    const target = { mode: "new", id: randomUUID(), name: "Saved copy" };
    const created = await request(savePath, "gm", "POST", { expectedRevision: 0, target });
    expect(created.status).toBe(201);
    const { template } = (await created.json()) as { template: StoredClass };
    expect(withoutChildIds(template.definition)).toEqual({
      ...withoutChildIds(original),
      name: target.name,
    });
    const retry = await request(savePath, "gm", "POST", { expectedRevision: 0, target });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ template });

    const saved = await request(savePath, "gm", "POST", { expectedRevision: 0, target: update });
    expect(saved.status).toBe(200);
    const { template: replacement } = (await saved.json()) as { template: StoredClass };
    expect(replacement).toMatchObject({ id: create.id, revision: 2 });
    expect(withoutChildIds(replacement.definition)).toEqual(withoutChildIds(original));
    expect(await listTemplates("gm")).toEqual(expect.arrayContaining([template, replacement]));
    const copies = (await listClasses(ids.game, "gm")).filter(
      ({ id }) => id === first.id || id === second.id,
    );
    expect(copies).toHaveLength(2);
    expect(copies).toEqual(expect.arrayContaining([first, second]));

    await pool.query("DELETE FROM game_classes WHERE id = $1", [copy.id]);
    const removedRetry = await request(path, "gm", "POST", copy);
    expect(removedRetry.status).toBe(409);
    expect((await removedRetry.json()).error.code).toBe("id_conflict");
    expect((await listClasses(ids.game, "gm")).some(({ id }) => id === copy.id)).toBe(false);
  });
});
