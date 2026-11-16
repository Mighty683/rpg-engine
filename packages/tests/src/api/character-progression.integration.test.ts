import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  CharacterChanges,
  CharacterRecord,
  PartyCharacter,
} from "../../../backend/src/modules/characters/types.ts";
import type {
  ClassBenefit,
  ClassDefinition,
  ClassModifierStat,
  StoredClass,
} from "../../../backend/src/modules/class-catalog/types.ts";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

function modifier(stat: ClassModifierStat, amount: number, perRank = false): ClassBenefit {
  return { id: randomUUID(), kind: "modifier", name: stat, stat, amount, perRank };
}
function definition(name: string): ClassDefinition {
  return {
    name,
    description: "",
    freeBenefits: [
      modifier("maxHp", 7),
      modifier("dieDex", 1),
      modifier("dieIns", -3),
      modifier("defense", 3),
    ],
    skills: [
      {
        id: randomUUID(),
        name: "Resolve",
        description: "",
        maxRank: 2,
        benefits: [
          modifier("maxMp", 4, true),
          modifier("dieMig", 4),
          modifier("magicDefense", -2, true),
        ],
      },
    ],
  };
}

describe("character progression", () => {
  let fixture: ApiFixture;
  beforeEach(async () => {
    fixture = await createApiFixture("character_progression");
  });
  afterEach(async () => {
    await fixture?.cleanup();
  });

  async function installClass(name: string, foreign = false) {
    const { request, ids } = fixture;
    const actor = foreign ? "outsider" : "gm";
    const gameId = foreign ? ids.otherGame : ids.game;
    const templateId = randomUUID();
    const response = await request("/library/class", actor, "POST", {
      id: templateId,
      systemId: "fabula-ultima",
      definition: definition(name),
    });
    expect(response.status).toBe(201);
    const copy = await request(`/games/${gameId}/classes`, actor, "POST", {
      id: randomUUID(),
      templateId,
      expectedTemplateRevision: 0,
    });
    expect(copy.status).toBe(201);
    return ((await copy.json()) as { gameClass: StoredClass }).gameClass;
  }

  function characterPath(id: string) {
    return `/games/${fixture.ids.game}/characters/${id}`;
  }
  async function readCharacter(id: string, actor: string) {
    const result = await fixture.request(characterPath(id), actor);
    expect(result.status).toBe(200);
    return ((await result.json()) as { character: CharacterRecord }).character;
  }
  async function write(
    id: string,
    actor: string,
    expectedRevision: number,
    changes: CharacterChanges,
  ) {
    return fixture.request(characterPath(id), actor, "PATCH", { expectedRevision, changes });
  }
  async function save(
    id: string,
    actor: string,
    expectedRevision: number,
    changes: CharacterChanges,
  ) {
    const response = await write(id, actor, expectedRevision, changes);
    expect(response.status).toBe(200);
    return ((await response.json()) as { character: CharacterRecord }).character;
  }
  async function readParty(actor: string) {
    const response = await fixture.request(`/games/${fixture.ids.game}/party`, actor);
    expect(response.status).toBe(200);
    return ((await response.json()) as { characters: PartyCharacter[] }).characters;
  }

  it("API-03 keeps progression private while preserving manual sheet fields and authorized edits", async () => {
    const { gmCharacter, playerCharacter } = fixture.ids;
    const manual = [{ id: randomUUID(), name: "Manual", notes: "Before allocations" }];
    const saved = await save(gmCharacter, "gm", 0, { level: 8, classes: manual, skills: manual });
    expect(saved.sheet).toMatchObject({ level: 8, classes: manual, skills: manual });
    expect(saved.progression).toEqual({
      experience: { current: 50, total: 50 },
      classLevels: [],
      skillRanks: [],
    });

    const own = await readCharacter(playerCharacter, "player");
    const edited = await save(playerCharacter, "player", own.revision, {
      progression: { experience: { current: 51, total: 60 } },
    });
    expect(edited.progression?.experience).toEqual({ current: 51, total: 60 });
    expect((await readCharacter(playerCharacter, "gm")).progression).toEqual(edited.progression);
    const denied = await readCharacter(gmCharacter, "player");
    expect(denied).not.toHaveProperty("progression");
    expect(denied.sheet).toMatchObject({ level: 8, classes: manual, skills: manual });
    expect(
      (
        await write(gmCharacter, "player", saved.revision, {
          progression: { experience: { current: 0, total: 0 } },
        })
      ).status,
    ).toBe(403);
    expect(await readCharacter(gmCharacter, "gm")).toEqual(saved);
    const party = await readParty("player");
    expect(party.find(({ id }) => id === playerCharacter)).not.toHaveProperty("progression");
    expect(party.find(({ id }) => id === playerCharacter)).not.toHaveProperty("experience");
    expect(party.find(({ id }) => id === playerCharacter)).not.toHaveProperty("skillRanks");
  });

  it("API-04 applies EXP and allocation changes atomically and at most once per revision", async () => {
    const { ids, request, pool } = fixture;
    const id = randomUUID();
    const response = await request(`/games/${ids.game}/characters`, "player", "POST", {
      id,
      name: "New hero",
    });
    expect(response.status).toBe(201);
    const created = (await response.json()).character;
    expect(created).toMatchObject({
      level: 5,
      progression: { experience: { current: 50, total: 50 } },
    });
    const local = await installClass("Guardian");
    const foreign = await installClass("Foreign", true);
    const skillId = local.definition.skills[0]!.id;
    const classLevels = [{ gameClassId: local.id, level: 2 }];
    const allocated = await save(id, "player", 0, {
      progression: {
        experience: { current: 60, total: 65 },
        classLevels,
      },
    });
    expect(allocated.progression).toMatchObject({
      experience: { current: 40, total: 65 },
      classLevels,
    });
    const skilled = await save(id.toUpperCase(), "player", allocated.revision, {
      level: 7,
      progression: { skillRanks: [{ skillId, rank: 2 }] },
    });
    expect(skilled).toMatchObject({
      level: 7,
      progression: {
        experience: { current: 40, total: 65 },
        classLevels,
        skillRanks: [{ skillId, rank: 2 }],
      },
    });
    const state = () =>
      pool
        .query(
          `SELECT revision, exp_current, exp_total,
        ARRAY(SELECT game_class_id || ':' || level FROM character_class_levels WHERE character_id=$1 ORDER BY game_class_id) AS classes,
        ARRAY(SELECT skill_id || ':' || rank FROM character_skill_ranks WHERE character_id=$1 ORDER BY skill_id) AS skills
        FROM characters WHERE id=$1`,
          [id],
        )
        .then(({ rows }) => rows[0]);
    const before = await state();
    const invalid: NonNullable<CharacterChanges["progression"]>[] = [
      { classLevels: [{ gameClassId: local.id, level: 7 }] },
      { classLevels: [{ gameClassId: local.id, level: 1 }] },
      { classLevels: [{ gameClassId: local.id, level: 11 }] },
      { classLevels: [{ gameClassId: foreign.id, level: 2 }] },
      { classLevels: [...classLevels, { gameClassId: local.id.toUpperCase(), level: 2 }] },
      { skillRanks: [{ skillId, rank: 3 }] },
      {
        skillRanks: [
          { skillId, rank: 1 },
          { skillId: skillId.toUpperCase(), rank: 1 },
        ],
      },
      { skillRanks: [{ skillId: foreign.definition.skills[0]!.id, rank: 1 }] },
      { experience: { current: 60, total: 65 } },
    ];
    for (const progression of invalid) {
      expect(
        (await write(id, "player", skilled.revision, { progression, name: "No partial write" }))
          .status,
      ).toBe(422);
      expect(await state()).toEqual(before);
    }
    expect(
      (await write(id, "player", allocated.revision, { progression: { skillRanks: [] } })).status,
    ).toBe(409);
    expect(await state()).toEqual(before);

    const next = { progression: { classLevels: [{ gameClassId: local.id, level: 3 }] } };
    const concurrent = await Promise.all([
      write(id, "player", skilled.revision, next),
      write(id, "player", skilled.revision, next),
    ]);
    expect(concurrent.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 409]);
    const once = await readCharacter(id, "player");
    expect(once.progression?.experience).toEqual({ current: 30, total: 65 });
    const refunded = await save(id, "player", once.revision, {
      progression: {
        classLevels: [],
        skillRanks: [],
      },
    });
    expect(refunded).toMatchObject({
      level: 7,
      progression: { experience: { current: 60, total: 65 } },
    });
  });

  it("API-05 projects free and rank-scaled effects through the sheet, party, and default rolls", async () => {
    const { ids, request } = fixture;
    const member = ids.playerCharacter;
    const path = `/games/${ids.game}/throws`;
    async function roll(revision: number, dice: Record<string, number> = {}, kind = "attribute") {
      const setup = {
        type: kind,
        characterId: member,
        expectedRevision: revision,
        modifier: 0,
        note: "",
        ...(kind === "attribute"
          ? { attributes: ["DEX"], dice, redDice: [], redModifier: 0 }
          : {
              equipmentId: weapon.id,
              dice: [6, 8],
            }),
      };
      const result = await request(path, "player", "POST", { sourceThrowId: null, setup });
      expect(result.status).toBe(201);
      return (await result.json()).throw;
    }
    const weapon = {
      id: randomUUID(),
      name: "Blade",
      notes: "",
      kind: "weapon",
      priceZenit: null,
      equipped: true,
      accuracyDice: ["DEX", "MIG"],
      accuracyBonus: 0,
    } as const;
    const original = await readCharacter(member, "player");
    const history = await roll(original.revision);
    expect(history.setup.dice[0].size).toBe(8);
    const gameClass = await installClass("Bulwark");
    const initial = await save(member, "player", original.revision, {
      resources: { hp: 49, mp: 1, ip: 17 },
      equipment: [
        { ...weapon, accuracyDice: ["DEX", "MIG"] },
        {
          id: randomUUID(),
          kind: "armor",
          name: "Fixed armor",
          notes: "",
          priceZenit: null,
          equipped: true,
          fixedDefense: 11,
          defenseBonus: 99,
          magicDefenseBonus: 2,
          initiativeModifier: 0,
        },
      ],
      overrides: { maxHp: 50, magicDefense: 21 },
      progression: { classLevels: [{ gameClassId: gameClass.id, level: 2 }] },
    });
    expect(initial.derived).toMatchObject({
      currentDice: { DEX: 10, INS: 6, MIG: 6, WLP: 8 },
      maxima: { hp: 57, mp: 45, ip: 6 },
      defenses: { defense: { calculated: 14 }, magicDefense: { calculated: 8 } },
    });
    const learned = await save(member, "gm", initial.revision, {
      progression: {
        skillRanks: [{ skillId: gameClass.definition.skills[0]!.id, rank: 2 }],
      },
    });
    expect(learned.derived).toMatchObject({
      currentDice: { DEX: 10, INS: 6, MIG: 12, WLP: 8 },
      maxima: { hp: 57, mp: 53, ip: 6 },
      defenses: { defense: { calculated: 14 }, magicDefense: { calculated: 4 } },
    });
    expect(learned.sheet.resources).toMatchObject({ hp: 49, mp: 1, ip: 17 });
    const projected = (await readParty("gm")).find(({ id }) => id === member);
    expect(projected).toMatchObject({
      classes: ["Bulwark 2"],
      currentDice: learned.derived.currentDice,
      maxima: learned.derived.maxima,
      resources: learned.sheet.resources,
      defense: 14,
      magicDefense: 21,
    });
    expect((await roll(learned.revision)).setup.dice[0].size).toBe(10);
    expect((await roll(learned.revision, { DEX: 6 })).setup.dice[0].size).toBe(6);
    expect(
      (await roll(learned.revision, {}, "weapon")).setup.dice.map(
        ({ size }: { size: number }) => size,
      ),
    ).toEqual([6, 8]);
    const logged = await request(path, "player");
    expect(logged.status).toBe(200);
    expect(
      (await logged.json()).throws.find(({ id }: { id: string }) => id === history.id)?.setup,
    ).toEqual(history.setup);
  });
});
