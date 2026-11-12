/** Verify shared persistence and offline error branches through actual HTTP handlers. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { setupServer } from "msw/node";
import { prototypeHandlers } from "./handlers";
import { resetPrototypeBackend, setPrototypeScenario } from "./store";

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
