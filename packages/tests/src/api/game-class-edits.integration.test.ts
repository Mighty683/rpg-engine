import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import type {
  ClassDefinition,
  StoredClass,
} from "../../../backend/src/modules/class-catalog/types.ts";
import type { CharacterRecord } from "../../../backend/src/modules/characters/types.ts";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

const catalog = (gameId: string) => `/games/${gameId}/classes`;
const sheet = (gameId: string, characterId: string) => `/games/${gameId}/characters/${characterId}`;

const definition = (): ClassDefinition => ({
  name: "Keeper",
  description: "Watch the road.",
  freeBenefits: [
    { id: randomUUID(), kind: "modifier", name: "Fortitude", stat: "maxHp", amount: 2 },
  ],
  skills: [
    {
      id: randomUUID(),
      name: "Deflect",
      description: "",
      maxRank: 3,
      benefits: [
        {
          id: randomUUID(),
          kind: "modifier",
          name: "Parry",
          stat: "maxHp",
          amount: 3,
          perRank: true,
        },
      ],
    },
    { id: randomUUID(), name: "Watch", description: "", maxRank: 1, benefits: [] },
  ],
});

describe("game class edits", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("game_class_edits", { appOrigin: "https://rpg.example" });
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  async function createClass(gameId: string, actor = "gm") {
    const templateId = randomUUID();
    expect(
      (
        await fixture.request("/library/class", actor, "POST", {
          id: templateId,
          systemId: "fabula-ultima",
          definition: definition(),
        })
      ).status,
    ).toBe(201);
    const response = await fixture.request(catalog(gameId), actor, "POST", {
      id: randomUUID(),
      templateId,
      expectedTemplateRevision: 0,
    });
    expect(response.status).toBe(201);
    const { gameClass } = (await response.json()) as { gameClass: StoredClass };
    return { templateId, gameClass };
  }

  async function list(gameId: string, actor = "gm") {
    const response = await fixture.request(catalog(gameId), actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { classes: StoredClass[] }).classes;
  }

  async function record(gameId: string, characterId: string) {
    const response = await fixture.request(sheet(gameId, characterId), "gm");
    expect(response.status).toBe(200);
    return ((await response.json()) as { character: CharacterRecord }).character;
  }

  async function setRanks(
    gameId: string,
    characterId: string,
    character: CharacterRecord,
    gameClass: StoredClass,
    rank: number,
  ) {
    const response = await fixture.request(sheet(gameId, characterId), "gm", "PATCH", {
      expectedRevision: character.revision,
      changes: {
        progression: {
          classLevels: rank ? [{ gameClassId: gameClass.id, level: rank }] : [],
          skillRanks: rank ? [{ skillId: gameClass.definition.skills[0]!.id, rank }] : [],
        },
      },
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as { character: CharacterRecord }).character;
  }

  it("API-01 scopes PATCH and DELETE to the GM and the game in the route", async () => {
    const { ids, request, origin, tokens } = fixture;
    const { gameClass } = await createClass(ids.game);
    const local = `${catalog(ids.game)}/${gameClass.id}`;
    const foreign = `${catalog(ids.otherGame)}/${gameClass.id}`;
    const patch = { expectedRevision: 0, definition: { ...gameClass.definition, name: "Changed" } };
    const removal = { expectedRevision: 0 };

    for (const [method, input] of [
      ["PATCH", patch],
      ["DELETE", removal],
    ] as const) {
      expect((await request(local, null, method, input)).status).toBe(401);
      expect((await request(local, "player", method, input)).status).toBe(403);
      expect((await request(foreign, "outsider", method, input)).status).toBe(404);
      expect((await request(local, "gm", method, input, "https://wrong.example")).status).toBe(403);
      const missingCsrf = await fetch(`${origin}/api${local}`, {
        method,
        headers: {
          cookie: `rpg_session=${tokens.gm}`,
          origin: "https://rpg.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      expect(missingCsrf.status).toBe(403);
      expect((await missingCsrf.json()).error.code).toBe("invalid_csrf");
      expect(await list(ids.game)).toContainEqual(gameClass);
      expect(await list(ids.otherGame, "outsider")).toEqual([]);
    }
  });

  it("API-06 preserves assigned state when saving to the library and removes an unassigned class only", async () => {
    const { ids, request } = fixture;
    const { templateId, gameClass } = await createClass(ids.game);
    const path = `${catalog(ids.game)}/${gameClass.id}`;
    const before = await setRanks(
      ids.game,
      ids.playerCharacter,
      await record(ids.game, ids.playerCharacter),
      gameClass,
      1,
    );
    const savedId = randomUUID();
    expect(
      (
        await request(`${path}/save-to-library`, "gm", "POST", {
          expectedRevision: 0,
          target: { mode: "new", id: savedId, name: "Backup" },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`${path}/save-to-library`, "gm", "POST", {
          expectedRevision: 0,
          target: { mode: "update", templateId, expectedTemplateRevision: 0 },
        })
      ).status,
    ).toBe(200);
    const blocked = await request(path, "gm", "DELETE", { expectedRevision: 0 });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe("class_in_use");
    expect(await record(ids.game, ids.playerCharacter)).toEqual(before);
    expect(await list(ids.game)).toContainEqual(gameClass);
    const cleared = await setRanks(ids.game, ids.playerCharacter, before, gameClass, 0);
    expect((await request(path, "gm", "DELETE", { expectedRevision: 1 })).status).toBe(409);
    expect((await request(path, "gm", "DELETE", { expectedRevision: 0 })).status).toBe(204);
    expect((await list(ids.game)).map(({ id }) => id)).not.toContain(gameClass.id);
    expect(await record(ids.game, ids.playerCharacter)).toEqual(cleared);
    const { templates } = await (await request("/library/class", "gm")).json();
    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: templateId, revision: 1 }),
        expect.objectContaining({ id: savedId, revision: 0 }),
      ]),
    );
  });

  it("API-07 rechecks learned ranks, commits removal atomically, and publishes committed state", async () => {
    const { ids, request } = fixture;
    const { gameClass } = await createClass(ids.game);
    const path = `${catalog(ids.game)}/${gameClass.id}`;
    const [learned, retained] = gameClass.definition.skills;
    const previous = await setRanks(
      ids.game,
      ids.playerCharacter,
      await record(ids.game, ids.playerCharacter),
      gameClass,
      2,
    );
    const cap = { ...gameClass.definition, skills: [{ ...learned!, maxRank: 1 }, retained!] };
    expect(
      (await request(path, "gm", "PATCH", { expectedRevision: 0, definition: cap })).status,
    ).toBe(422);
    const patch = {
      expectedRevision: 0,
      definition: { ...gameClass.definition, skills: [retained!] },
    };
    const rejected = await request(path, "gm", "PATCH", patch);
    expect(rejected.status).toBe(409);
    const { error: firstImpact } = await rejected.json();
    expect(firstImpact).toMatchObject({
      code: "skill_removal_confirmation_required",
      impact: [
        {
          skillId: learned!.id,
          characters: [{ id: ids.playerCharacter, name: "Player sheet", rank: 2 }],
        },
      ],
    });
    expect(await record(ids.game, ids.playerCharacter)).toEqual(previous);
    expect(await list(ids.game)).toContainEqual(gameClass);

    const second = await setRanks(
      ids.game,
      ids.gmCharacter,
      await record(ids.game, ids.gmCharacter),
      gameClass,
      1,
    );
    const changed = await request(path, "gm", "PATCH", {
      ...patch,
      confirmedSkillRemovals: firstImpact.impact,
    });
    expect(changed.status).toBe(409);
    const { error: currentImpact } = await changed.json();
    expect(currentImpact.impact).toEqual([
      {
        skillId: learned!.id,
        characters: expect.arrayContaining([
          { id: ids.playerCharacter, name: "Player sheet", rank: 2 },
          { id: ids.gmCharacter, name: "GM sheet", rank: 1 },
        ]),
      },
    ]);
    expect(await record(ids.game, ids.playerCharacter)).toEqual(previous);
    expect(await record(ids.game, ids.gmCharacter)).toEqual(second);

    const stream = await request(`/games/${ids.game}/events`, "player");
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    try {
      const result = await request(path, "gm", "PATCH", {
        ...patch,
        confirmedSkillRemovals: currentImpact.impact,
      });
      expect(result.status).toBe(200);
      const { gameClass: updated } = await result.json();
      expect(updated).toEqual({ ...gameClass, revision: 1, definition: patch.definition });
      let data = "";
      while (data.split("data: ").length < 4) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("Class event stream closed early");
        data += decoder.decode(chunk.value, { stream: true });
      }
      const events = data
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)));
      expect(events.slice(0, 2)).toEqual(
        expect.arrayContaining([
          { type: "sheet", characterId: ids.playerCharacter },
          { type: "sheet", characterId: ids.gmCharacter },
        ]),
      );
      expect(events[2]).toEqual({ type: "roster" });

      for (const character of [previous, second]) {
        const saved = await record(ids.game, character.id);
        expect(saved.revision).toBe(character.revision + 1);
        expect(saved.progression).toEqual({ ...character.progression, skillRanks: [] });
        expect(saved.derived.maxima.hp).toBe(37);
      }
    } finally {
      await reader.cancel();
    }
  });
});
