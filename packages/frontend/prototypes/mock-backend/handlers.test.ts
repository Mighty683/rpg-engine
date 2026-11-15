/** Verify shared persistence and offline error branches through actual HTTP handlers. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { setupServer } from "msw/node";
import { withProgressionRanks } from "../../src/modules/class-progression/model";
import { createProgressionApi } from "../class-progression/api";
import {
  classGamePath,
  gameClassesPath,
  libraryPath,
  skillRanks,
  classLevels,
  wireId,
} from "../class-management/contract";
import type { Benefit, CharacterChanges, StoredClass } from "../class-management/contract";
import { prototypeHandlers } from "./handlers";
import { prototypeStore, resetPrototypeBackend, setPrototypeScenario } from "./store";

const server = setupServer(...prototypeHandlers);
const root = "http://localhost/api";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => resetPrototypeBackend());

describe("prototype backend", () => {
  it("shares revisioned sheet writes across character and party reads", async () => {
    const url = `${root}/games/prototype-game/characters/rowan`;
    const original = await fetch(url).then((response) => response.json());
    expect(original.character.sheet.name).toBe("Rowan Ash");
    const patch = { expectedRevision: 1, changes: { name: "Edited Rowan", resources: { hp: 9 } } };
    const saved = await fetch(url, { method: "PATCH", body: JSON.stringify(patch) }).then(
      (response) => response.json(),
    );
    expect(saved.character.revision).toBe(2);
    expect(saved.character.sheet.resources).toMatchObject({ hp: 9, mp: 24 });
    const party = await fetch(`${root}/games/prototype-game/party`).then((response) =>
      response.json(),
    );
    expect(party.characters[0]).toMatchObject({
      name: "Edited Rowan",
      revision: 2,
      resources: { hp: 9 },
    });
    expect(party.characters[1]).toMatchObject({ id: "nera", name: "Nera Vale", weapons: [] });
    expect((await fetch(url, { method: "PATCH", body: JSON.stringify(patch) })).status).toBe(409);
    expect((await fetch(`${url}-missing`)).status).toBe(404);
  });

  it("applies and resets response scenarios", async () => {
    const url = `${root}/games/prototype-game/party`;
    setPrototypeScenario("error");
    expect((await fetch(url)).status).toBe(500);
    resetPrototypeBackend("empty");
    expect(await fetch(url).then((response) => response.json())).toEqual({ characters: [] });
    resetPrototypeBackend();
    expect((await fetch(url).then((response) => response.json())).characters).toHaveLength(2);
  });

  it("records submitted dice and notes and deletes history entries", async () => {
    const url = `${root}/games/prototype-game/throws`;
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        sourceThrowId: null,
        setup: {
          type: "free",
          characterId: "nera",
          dice: [20],
          modifier: 2,
          redDice: [],
          redModifier: 0,
          note: "Review roll",
        },
      }),
    });
    const { throw: record } = await response.json();
    expect(record).toMatchObject({
      private: false,
      characterName: "Nera Vale",
      setup: { note: "Review roll", dice: [{ label: null, size: 20 }] },
      outcome: { first: { total: 8 } },
    });
    expect((await fetch(`${url}?limit=1`).then((result) => result.json())).throws[0].id).toBe(
      record.id,
    );
    expect(
      await fetch(`${url}/${record.id}`, { method: "DELETE" }).then((result) => result.json()),
    ).toEqual({ deleted: true });
  });

  it("projects edited equipment, readiness, armor ambiguity and explicit overrides", async () => {
    const url = `${root}/games/prototype-game/characters/rowan`;
    const equipment = [
      {
        id: "blade",
        kind: "weapon",
        name: "Edited blade",
        equipped: true,
        accuracyDice: ["DEX", null],
        accuracyBonus: null,
        reach: "ranged",
        damageBonus: 7,
        damageType: "fire",
      },
      {
        id: "armor",
        kind: "armor",
        equipped: true,
        fixedDefense: 11,
        defenseBonus: 99,
        magicDefenseBonus: 2,
        initiativeModifier: -3,
      },
      {
        id: "shield",
        kind: "shield",
        equipped: true,
        defenseBonus: 1,
        magicDefenseBonus: 1,
        initiativeModifier: -1,
      },
    ];
    await fetch(url, {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision: 1, changes: { equipment } }),
    });
    const getParty = () =>
      fetch(`${root}/games/prototype-game/party`).then((response) => response.json());
    const party = await getParty();
    expect(party.characters[0]).toMatchObject({
      defense: 12,
      magicDefense: 11,
      weapons: [
        {
          name: "Edited blade",
          accuracyBonus: null,
          ready: false,
          reach: "ranged",
          damageBonus: 7,
          damageType: "fire",
        },
      ],
    });
    const full = await fetch(url).then((response) => response.json());
    expect(full.character.derived.defenses.initiative.calculated).toBe(-4);
    equipment.push({ ...equipment[1], id: "second-armor" });
    await fetch(url, {
      method: "PATCH",
      body: JSON.stringify({
        expectedRevision: 2,
        changes: { equipment, overrides: { magicDefense: 15 } },
      }),
    });
    expect((await getParty()).characters[0]).toMatchObject({ defense: null, magicDefense: 15 });
  });
});

describe("prototype catalog progression", () => {
  const origin = "http://localhost";
  const catalogUrl = origin + gameClassesPath;
  const characterUrl = (id: string) => `${origin}${classGamePath}/characters/${wireId(id)}`;
  const api = createProgressionApi(undefined, origin);
  const patch = (id: string, expectedRevision: number, changes: CharacterChanges) =>
    fetch(characterUrl(id), {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision, changes }),
    });

  it("derives resource and die modifiers from the same saved class and skill allocations", async () => {
    const { classes }: { classes: StoredClass[] } = await fetch(catalogUrl).then((response) =>
      response.json(),
    );
    const guardian = classes.find(({ id }) => id === wireId("guardian"))!;
    const modifier = (
      stat: Extract<Benefit, { kind: "modifier" }>["stat"],
      amount: number,
      perRank = false,
    ): Benefit => ({
      id: crypto.randomUUID(),
      name: stat,
      stat,
      amount,
      kind: "modifier",
      perRank,
    });
    const definition = {
      ...guardian.definition,
      freeBenefits: [
        ...guardian.definition.freeBenefits,
        modifier("maxIp", 2),
        modifier("dieDex", 1),
        modifier("dieMig", 3),
      ],
      skills: guardian.definition.skills.map((skill) =>
        skill.id === wireId("resolve")
          ? {
              ...skill,
              benefits: [
                ...skill.benefits,
                modifier("defense", 1, true),
                modifier("magicDefense", -1),
                modifier("dieIns", -2),
                modifier("dieWlp", 1),
              ],
            }
          : skill,
      ),
    };
    expect(
      (
        await fetch(`${catalogUrl}/${guardian.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expectedRevision: guardian.revision, definition }),
        })
      ).status,
    ).toBe(200);

    const snapshot = await api.load();
    const rowan = snapshot.characters[0]!;
    expect(rowan.sheet.baseDice).toEqual({ DEX: 8, INS: 8, MIG: 10, WLP: 8 });
    expect(snapshot.party[0]).toMatchObject({
      currentDice: { DEX: 10, INS: 6, MIG: 12, WLP: 10 },
      defense: 12,
      magicDefense: 5,
      maxima: { hp: 64, mp: 50, ip: 8 },
      resources: { ip: 5 },
    });
    const ranks = { ...rowan.ranks, resolve: 0 };
    const preview = withProgressionRanks(snapshot.catalog, rowan, ranks, rowan.levels);
    const response = await patch(rowan.id, rowan.revision, {
      progression: { skillRanks: skillRanks(ranks) },
    });
    expect(response.status).toBe(200);
    expect((await api.load()).party[0]).toEqual({ ...preview.party, revision: rowan.revision + 1 });
    expect(preview.party).toMatchObject({
      currentDice: { DEX: 10, INS: 8, MIG: 12, WLP: 8 },
      defense: 10,
      magicDefense: 8,
      maxima: { hp: 60, mp: 50, ip: 8 },
    });
    const sheet = prototypeStore.progressionCharacters[0]!.sheet as typeof rowan.sheet;
    sheet.equipment.push(
      {
        id: "armor",
        name: "Heavy armor",
        notes: "",
        priceZenit: null,
        kind: "armor",
        equipped: true,
        fixedDefense: 11,
      },
      {
        id: "shield",
        name: "Shield",
        notes: "",
        priceZenit: null,
        kind: "shield",
        equipped: true,
        defenseBonus: 2,
        magicDefenseBonus: 1,
      },
    );
    expect((await api.load()).party[0]).toMatchObject({ defense: 13, magicDefense: 9 });
  });

  it("persists a class before choosing skills and debits or refunds EXP on the server", async () => {
    const id = "catalog-new";
    const original = (await api.load()).characters.find((entry) => entry.id === id)!;
    const save = (
      levels: Record<string, number>,
      ranks: Record<string, number>,
      revision: number,
    ) =>
      patch(id, revision, {
        progression: { classLevels: classLevels(levels), skillRanks: skillRanks(ranks) },
      });

    expect((await save({ scholar: 1 }, {}, original.revision)).status).toBe(200);
    const selected = (await api.load()).characters.find((entry) => entry.id === id)!;
    expect(selected).toMatchObject({
      levels: { scholar: 1 },
      ranks: {},
      experience: { current: 40, total: 50 },
      sheet: { level: 5, classes: [{ id: "scholar" }] },
    });
    expect(selected.party.maxima.mp).toBe(original.party.maxima.mp + 5);
    expect((await save({ scholar: 1 }, { insight: 2 }, selected.revision)).status).toBe(422);
    expect((await save({ scholar: 1 }, { insight: 1 }, selected.revision)).status).toBe(200);
    expect((await save({ scholar: 0 }, { insight: 1 }, selected.revision + 1)).status).toBe(422);
    const refund = await save({}, {}, selected.revision + 1);
    expect(refund.status).toBe(200);
    expect((await refund.json()).character.progression.experience).toEqual({
      current: 50,
      total: 50,
    });
  });

  it("checks revisions and permissions without altering unrelated sheets", async () => {
    const original = await api.load();
    const rowan = original.characters[0]!;
    const changes = {
      level: 6,
      progression: {
        classLevels: classLevels({ guardian: 4, scholar: 2 }),
        skillRanks: skillRanks({ resolve: 3, cover: 1, insight: 2 }),
      },
    };
    const alias = wireId("catalog-nera");
    const headers = { "x-prototype-character": alias };
    const foreign = await fetch(characterUrl(rowan.id), { headers }).then((response) =>
      response.json(),
    );
    expect(foreign.character).toMatchObject({ canEdit: false });
    expect(foreign.character.progression).toBeUndefined();
    const rejected = await fetch(characterUrl(rowan.id), {
      headers,
      method: "PATCH",
      body: JSON.stringify({ expectedRevision: rowan.revision, changes }),
    });
    expect(rejected.status).toBe(403);
    expect((await patch(rowan.id, rowan.revision, changes)).status).toBe(200);
    expect((await patch(rowan.id, rowan.revision, changes)).status).toBe(409);
    const saved = await api.load();
    expect(saved.characters[0]).toMatchObject({
      revision: 2,
      experience: { current: 30, total: 90 },
      sheet: { level: 6 },
      party: { level: 6, maxima: { hp: 67, mp: 51 } },
    });
    expect(saved.characters[1]).toEqual(original.characters[1]);
    const manual = await fetch(`${root}/games/prototype-game/characters/rowan`).then((response) =>
      response.json(),
    );
    expect(manual.character.sheet).toMatchObject({ level: 5, skills: [] });
    expect(manual.character.revision).toBe(1);
  });

  it("saves an assigned game class to the library and rechecks skill-removal impact", async () => {
    const { classes }: { classes: StoredClass[] } = await fetch(catalogUrl).then((response) =>
      response.json(),
    );
    const guardian = classes.find(({ id }) => id === wireId("guardian"))!;
    const url = `${catalogUrl}/${guardian.id}`;
    const write = (method: string, target: string, body: unknown) =>
      fetch(target, { method, body: JSON.stringify(body) });
    const newId = crypto.randomUUID();
    const payload = {
      expectedRevision: guardian.revision,
      target: { mode: "new", id: newId, name: "Guardian template" },
    };
    const save = await write("POST", `${url}/save-to-library`, payload);
    expect(save.status).toBe(201);
    const { template } = await save.json();
    expect(template.definition.skills[0].id).not.toBe(guardian.definition.skills[0]!.id);
    expect((await write("POST", `${url}/save-to-library`, payload)).status).toBe(200);
    const update = await write("POST", `${url}/save-to-library`, {
      expectedRevision: guardian.revision,
      target: { mode: "update", templateId: newId, expectedTemplateRevision: template.revision },
    });
    expect(update.status).toBe(200);
    const library = await fetch(origin + libraryPath).then((response) => response.json());
    expect(library.templates).toHaveLength(1);
    expect(prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(2);
    expect((await write("DELETE", url, { expectedRevision: guardian.revision })).status).toBe(409);

    const changes = {
      expectedRevision: guardian.revision,
      definition: {
        ...guardian.definition,
        skills: guardian.definition.skills.filter(({ id }) => id !== wireId("resolve")),
      },
    };
    const conflict = await write("PATCH", url, changes);
    expect(conflict.status).toBe(409);
    const { error } = await conflict.json();
    expect(error).toMatchObject({
      code: "skill_removal_confirmation_required",
      impact: [
        {
          skillId: wireId("resolve"),
          characters: [{ id: wireId("catalog-rowan"), name: "Rowan Ash", rank: 2 }],
        },
      ],
    });
    const rowan = (await api.load()).characters[0]!;
    expect(
      (
        await patch(rowan.id, rowan.revision, {
          progression: { skillRanks: skillRanks({ ...rowan.ranks, resolve: 1 }) },
        })
      ).status,
    ).toBe(200);
    const retry = await write("PATCH", url, { ...changes, confirmedSkillRemovals: error.impact });
    expect(retry.status).toBe(409);
    const refreshed = (await retry.json()).error.impact;
    const confirmed = await write("PATCH", url, { ...changes, confirmedSkillRemovals: refreshed });
    expect(confirmed.status).toBe(200);
    expect(prototypeStore.progressionRanks["catalog-rowan"]).toEqual({ cover: 1, insight: 2 });
    expect(prototypeStore.progressionLevels["catalog-rowan"]?.guardian).toBe(3);
    expect(prototypeStore.progressionExperience.get("catalog-rowan")).toEqual({
      current: 40,
      total: 90,
    });
  });
});
