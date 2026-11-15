/** Verify shared persistence and offline error branches through actual HTTP handlers. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { setupServer } from "msw/node";
import { withProgressionRanks } from "../../src/modules/class-progression/model";
import type { ProgressionSnapshot } from "../../src/modules/class-progression/types";
import type { ClassCatalog, ClassCatalogChange } from "../../src/modules/class-management/types";
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
  it("derives resource, defense, and die modifiers consistently before and after a rank change", async () => {
    const catalogUrl = `${root}/prototype/class-catalog`;
    const progressionUrl = `${root}/prototype/class-progression`;
    const catalog: ClassCatalog = await fetch(catalogUrl).then((response) => response.json());
    const guardian = catalog.game.find(({ id }) => id === "guardian")!;
    const modifier = (stat: string, amount: number, perRank = false) => ({
      id: stat,
      name: stat,
      stat,
      amount: String(amount),
      kind: "modifier" as const,
      description: "",
      perRank,
    });
    const change: ClassCatalogChange = {
      kind: "put",
      scope: "game",
      entry: {
        ...guardian,
        benefits: [
          ...guardian.benefits,
          modifier("maxIp", 2),
          modifier("dieDex", 1),
          modifier("dieMig", 3),
        ],
        skills: guardian.skills.map((skill) =>
          skill.id === "resolve"
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
      },
    };
    expect(
      (await fetch(catalogUrl, { method: "POST", body: JSON.stringify({ changes: [change] }) }))
        .status,
    ).toBe(200);
    const load = async (): Promise<ProgressionSnapshot> =>
      fetch(progressionUrl).then((response) => response.json());
    const snapshot = await load();
    const rowan = snapshot.characters[0]!;
    expect(rowan.sheet.baseDice).toEqual({ DEX: 8, INS: 8, MIG: 10, WLP: 8 });
    expect(rowan.party).toMatchObject({
      currentDice: { DEX: 10, INS: 6, MIG: 12, WLP: 10 },
      defense: 12,
      magicDefense: 5,
      maxima: { hp: 64, mp: 50, ip: 8 },
      resources: { ip: 5 },
    });
    const ranks = { ...rowan.ranks, resolve: 0 };
    const preview = withProgressionRanks(snapshot.catalog, rowan, ranks, rowan.levels);
    const saved: ProgressionSnapshot = await fetch(`${progressionUrl}/${rowan.id}`, {
      method: "POST",
      body: JSON.stringify({
        expectedRevision: rowan.revision,
        level: rowan.sheet.level,
        levels: rowan.levels,
        ranks,
        experience: rowan.experience,
      }),
    }).then((response) => response.json());
    expect(saved.characters[0]?.party).toEqual({ ...preview.party, revision: rowan.revision + 1 });
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
    expect((await load()).characters[0]?.party).toMatchObject({ defense: 13, magicDefense: 9 });
    const removed = withProgressionRanks(snapshot.catalog, preview, { insight: 2 }, { scholar: 2 });
    expect(removed.party).toMatchObject({
      currentDice: rowan.sheet.baseDice,
      maxima: { ip: 6 },
      defense: 8,
    });
  });

  it("persists class levels and free bonuses before choosing any skill", async () => {
    const url = `${root}/prototype/class-progression`;
    const initial = await fetch(url).then((response) => response.json());
    const character = initial.characters.find(
      (entry: { id: string }) => entry.id === "catalog-new",
    );
    const save = (
      levels: Record<string, number>,
      ranks: Record<string, number>,
      revision: number,
    ) =>
      fetch(`${url}/catalog-new`, {
        method: "POST",
        body: JSON.stringify({
          levels,
          ranks,
          level: character.sheet.level,
          experience: { current: 50 - (levels.scholar ?? 0) * 10, total: 50 },
          expectedRevision: revision,
        }),
      });
    expect((await save({ scholar: 1 }, {}, character.revision)).status).toBe(200);
    const reloaded = await fetch(url).then((response) => response.json());
    const selected = reloaded.characters.find(
      (entry: { id: string }) => entry.id === "catalog-new",
    );
    expect(selected).toMatchObject({
      levels: { scholar: 1 },
      ranks: {},
      experience: { current: 40, total: 50 },
      sheet: { level: 5, classes: [{ id: "scholar" }] },
    });
    expect(selected.party.maxima.mp).toBe(character.party.maxima.mp + 5);
    expect((await save({ scholar: 1 }, { insight: 2 }, selected.revision)).status).toBe(400);
    expect((await save({ scholar: 1 }, { insight: 1 }, selected.revision)).status).toBe(200);
    expect((await save({ scholar: 0 }, { insight: 1 }, selected.revision + 1)).status).toBe(400);
    expect((await save({ scholar: 0 }, {}, selected.revision + 1)).status).toBe(200);
  });

  it("validates ranks, EXP, and revisions without altering manual character records", async () => {
    const url = `${root}/prototype/class-progression`;
    const original = await fetch(url).then((response) => response.json());
    const rowan = original.characters[0];
    expect(rowan.party.maxima.hp).toBe(64);
    const save = (ranks: Record<string, number>, revision = rowan.revision, current = 30) =>
      fetch(`${url}/${rowan.id}`, {
        method: "POST",
        body: JSON.stringify({
          expectedRevision: revision,
          level: 6,
          ranks,
          experience: { current, total: 90 },
          levels: {
            guardian: (ranks.resolve ?? 0) + (ranks.cover ?? 0),
            scholar: (ranks.insight ?? 0) + (ranks.study ?? 0),
          },
        }),
      });
    expect((await save({ resolve: 6, cover: 1, insight: 2 })).status).toBe(400);
    expect((await save({ resolve: 3, cover: 1, insight: 2 }, rowan.revision, 40)).status).toBe(400);
    const saved = await save({ resolve: 3, cover: 1, insight: 2 }).then((response) =>
      response.json(),
    );
    expect(saved.characters[0]).toMatchObject({
      revision: 2,
      experience: { current: 30, total: 90 },
      sheet: { level: 6 },
      party: { level: 6, maxima: { hp: 67, mp: 51 } },
    });
    expect(saved.characters[1]).toEqual(original.characters[1]);
    expect((await save({ resolve: 4, cover: 1, insight: 2 })).status).toBe(409);
    const manual = await fetch(`${root}/games/prototype-game/characters/rowan`).then((response) =>
      response.json(),
    );
    expect(manual.character.sheet).toMatchObject({ level: 5, skills: [] });
    expect(manual.character.revision).toBe(1);
    resetPrototypeBackend();
    expect((await fetch(url).then((response) => response.json())).characters[0]).toEqual(rowan);
  });
});
