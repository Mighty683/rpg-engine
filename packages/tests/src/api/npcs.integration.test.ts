import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

describe("NPC API", () => {
  let fixture: ApiFixture;
  beforeAll(async () => {
    fixture = await createApiFixture("npcs");
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it("projects visibility, rejects player writes and handles retry and stale deletion", async () => {
    const id = randomUUID();
    const npc = {
      name: "Test NPC",
      relationship: "enemy",
      level: 10,
      visibility: "hidden",
      baseDice: { DEX: 6, INS: 8, MIG: 10, WLP: 12 },
      hp: { current: 10, max: 20 },
      mp: { current: 3, max: 5 },
      defense: 7,
      magicDefense: 8,
      attacks: [
        {
          id: randomUUID(),
          name: "Claw",
          reach: "melee",
          attributes: ["DEX", "MIG"],
          damageBonus: 3,
          damageType: "physical",
        },
      ],
      notes: "secret",
    };
    const path = `/games/${fixture.ids.game}/npcs`;
    const streamControllers = [new AbortController(), new AbortController()];
    const streams = await Promise.all(
      ["gm", "player"].map((actor, index) =>
        fetch(`${fixture.origin}/api/games/${fixture.ids.game}/events`, {
          headers: { cookie: `rpg_session=${fixture.tokens[actor]}` },
          signal: streamControllers[index]!.signal,
        }),
      ),
    );
    const readers = streams.map((stream) => stream.body!.getReader());
    await Promise.all(readers.map((reader) => reader.read()));
    expect((await fixture.request(path, "gm", "POST", { id, npc })).status).toBe(201);
    for (const reader of readers) {
      const event = new TextDecoder().decode((await reader.read()).value);
      expect(event).toBe('data: {"type":"npcs"}\n\n');
    }
    streamControllers.forEach((controller) => controller.abort());
    expect((await fixture.request(`${path}/${id}`, "player")).status).toBe(404);
    expect(
      (await fixture.request(`${path}/${id}`, "player", "DELETE", { expectedRevision: 0 })).status,
    ).toBe(403);
    expect(
      (
        await fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 0,
          npc: { ...npc, attacks: [npc.attacks[0], npc.attacks[0]] },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 0,
          npc: { ...npc, extra: "forged" },
        })
      ).status,
    ).toBe(422);
    expect((await fixture.request(path, "player", "POST", { id: randomUUID(), npc })).status).toBe(
      403,
    );
    const visible = { ...npc, visibility: "visible" };
    expect(
      (await fixture.request(`${path}/${id}`, "gm", "PUT", { expectedRevision: 0, npc: visible }))
        .status,
    ).toBe(200);
    const player = await fixture.request(`${path}/${id}`, "player");
    expect(await player.json()).toEqual({
      npc: { view: "visible", id, name: "Test NPC", relationship: "enemy" },
    });
    expect((await fixture.request(path, "gm", "POST", { id, npc })).status).toBe(200);
    const known = { ...npc, visibility: "known" };
    expect(
      (await fixture.request(`${path}/${id}`, "gm", "PUT", { expectedRevision: 1, npc: known }))
        .status,
    ).toBe(200);
    const knownResult = await (await fixture.request(`${path}/${id}`, "player")).json();
    expect(knownResult.npc).toMatchObject({ view: "known", name: npc.name, attacks: npc.attacks });
    expect(knownResult.npc).not.toHaveProperty("notes");
    expect(knownResult.npc).not.toHaveProperty("visibility");
    const throwPath = `/games/${fixture.ids.game}/throws`;
    const attributeSetup = {
      type: "npc-attribute",
      npcId: id,
      expectedRevision: 2,
      attributes: ["DEX", "DEX"],
      dice: { DEX: 12 },
      modifier: 2,
      redDice: [6, 8],
      redModifier: -1,
      note: "Opposed",
    };
    const attributeRoll = await fixture.request(throwPath, "gm", "POST", {
      sourceThrowId: null,
      setup: attributeSetup,
    });
    expect(attributeRoll.status).toBe(201);
    const attributeResult = await attributeRoll.json();
    expect(attributeResult.throw.setup).toMatchObject({
      type: "npc-attribute",
      dice: [
        { label: "DEX", size: 12 },
        { label: "DEX", size: 12 },
      ],
      modifier: 2,
      redModifier: -1,
      note: "Opposed",
    });
    const baseRoll = await fixture.request(throwPath, "gm", "POST", {
      sourceThrowId: null,
      setup: { ...attributeSetup, dice: {}, redDice: [], redModifier: 0 },
    });
    expect(baseRoll.status).toBe(201);
    const baseResult = await baseRoll.json();
    expect(baseResult.throw.setup.dice).toEqual([
      { label: "DEX", size: 6 },
      { label: "DEX", size: 6 },
    ]);
    expect(
      (
        await fixture.request(throwPath, "gm", "POST", {
          sourceThrowId: null,
          setup: { ...attributeSetup, dice: { DEX: 12, WLP: 99 } },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await fixture.request(throwPath, "gm", "POST", {
          sourceThrowId: null,
          setup: { ...attributeSetup, expectedRevision: 1 },
        })
      ).status,
    ).toBe(409);
    const setup = {
      type: "npc-attack",
      npcId: id,
      attackId: npc.attacks[0]!.id,
      expectedRevision: 2,
      dice: [6, 10],
      modifier: 0,
      note: "",
    };
    expect(
      (await fixture.request(throwPath, "player", "POST", { sourceThrowId: null, setup })).status,
    ).toBe(403);
    const roll = await fixture.request(throwPath, "gm", "POST", { sourceThrowId: null, setup });
    expect(roll.status).toBe(201);
    const result = await roll.json();
    expect(result.throw.setup).toMatchObject({
      type: "npc-attack",
      npcId: id,
      attack: { accuracyBonus: 1 },
    });
    const revisedAttack = { ...npc.attacks[0]!, name: "Changed claw", damageBonus: 9 };
    expect(
      (
        await fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 2,
          npc: { ...known, attacks: [revisedAttack] },
        })
      ).status,
    ).toBe(200);
    const rerollSetup = { ...setup, expectedRevision: 3 };
    expect(
      (
        await fixture.request(throwPath, "gm", "POST", {
          sourceThrowId: attributeResult.throw.id,
          setup: rerollSetup,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await fixture.request(throwPath, "gm", "POST", {
          sourceThrowId: randomUUID(),
          setup: rerollSetup,
        })
      ).status,
    ).toBe(404);
    const reroll = await fixture.request(throwPath, "gm", "POST", {
      sourceThrowId: result.throw.id,
      setup: rerollSetup,
    });
    expect(reroll.status).toBe(201);
    const rerollResult = await reroll.json();
    expect(rerollResult.throw.setup.attack).toEqual(result.throw.setup.attack);
    expect(
      (
        await fixture.request(throwPath, "player", "POST", {
          sourceThrowId: result.throw.id,
          setup: rerollSetup,
        })
      ).status,
    ).toBe(403);
    const history = await (await fixture.request(throwPath, "player")).json();
    expect(history.throws).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.throw.id })]),
    );
    const recent = await (await fixture.request(`${throwPath}?limit=2`, "player")).json();
    expect(recent.throws.map((entry: { id: string }) => entry.id)).toEqual([
      result.throw.id,
      rerollResult.throw.id,
    ]);
    const older = await (
      await fixture.request(`${throwPath}?limit=2&before=${result.throw.seq}`, "player")
    ).json();
    expect(older.throws.map((entry: { id: string }) => entry.id)).toEqual([
      attributeResult.throw.id,
      baseResult.throw.id,
    ]);
    expect(
      (await fixture.request(`${throwPath}/${result.throw.id}`, "player", "DELETE")).status,
    ).toBe(403);
    expect((await fixture.request(path, "gm", "POST", { id, npc: visible })).status).toBe(409);
    expect(
      (await fixture.request(`${path}/${id}`, "gm", "DELETE", { expectedRevision: 0 })).status,
    ).toBe(409);
    expect(
      (await fixture.request(`${path}/${id}`, "gm", "DELETE", { expectedRevision: 3 })).status,
    ).toBe(204);
    expect((await fixture.request(`${path}/${id}`, "gm")).status).toBe(404);
    const historical = await (await fixture.request(throwPath, "player")).json();
    expect(historical.throws).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: result.throw.id })]),
    );
    expect(
      (
        await fixture.request(throwPath, "gm", "POST", {
          sourceThrowId: result.throw.id,
          setup: rerollSetup,
        })
      ).status,
    ).toBe(404);
  });

  it("rejects cross-game access, foreign attacks and concurrent stale writes without changing saved data", async () => {
    const id = randomUUID();
    const otherId = randomUUID();
    const attackId = randomUUID();
    const npc = {
      name: "Sentinel",
      relationship: "neutral",
      level: 5,
      visibility: "hidden",
      baseDice: { DEX: 8, INS: 8, MIG: 8, WLP: 8 },
      hp: { current: 10, max: 10 },
      mp: { current: 5, max: 5 },
      defense: 8,
      magicDefense: 8,
      notes: "secret",
      attacks: [],
    };
    const attack = {
      id: attackId,
      name: "Spear",
      reach: "melee",
      attributes: ["DEX", "MIG"],
      damageBonus: 1,
      damageType: "physical",
    };
    const path = `/games/${fixture.ids.game}/npcs`;
    const foreignPath = `/games/${fixture.ids.otherGame}/npcs`;
    expect(
      (await fixture.request(path, "gm", "POST", { id, npc: { ...npc, attacks: [attack] } }))
        .status,
    ).toBe(201);
    expect(
      (await fixture.request(foreignPath, "outsider", "POST", { id: otherId, npc })).status,
    ).toBe(201);
    expect((await fixture.request(foreignPath, "outsider", "POST", { id, npc })).status).toBe(409);
    expect((await fixture.request(path, null)).status).toBe(401);
    expect((await fixture.request(path, "outsider")).status).toBe(404);
    expect((await fixture.request(`${foreignPath}/${id}`, "outsider")).status).toBe(404);
    expect((await fixture.request(`${path}/${id}`, "player")).status).toBe(404);
    const boundaryId = randomUUID();
    const boundaryNpc = {
      ...npc,
      name: "x".repeat(100),
      level: 60,
      hp: { current: 0, max: 2147483647 },
      mp: { current: 0, max: 0 },
      defense: 2147483647,
      notes: "x".repeat(2000),
      attacks: [
        { ...attack, id: randomUUID(), damageBonus: -2147483648, damageType: "x".repeat(100) },
      ],
    };
    expect(
      (await fixture.request(path, "gm", "POST", { id: boundaryId, npc: boundaryNpc })).status,
    ).toBe(201);
    const boundarySaved = await (await fixture.request(`${path}/${boundaryId}`, "gm")).json();
    expect(boundarySaved.npc).toMatchObject(boundaryNpc);
    const invalidProfiles = [
      { ...npc, name: "  " },
      { ...npc, name: "x".repeat(101) },
      { ...npc, level: 4 },
      { ...npc, level: 61 },
      { ...npc, relationship: "stranger" },
      { ...npc, visibility: "revealed" },
      { ...npc, baseDice: { ...npc.baseDice, DEX: 7 } },
      { ...npc, hp: { current: 11, max: 10 } },
      { ...npc, mp: { current: -1, max: 5 } },
      { ...npc, defense: -1 },
      { ...npc, magicDefense: 2147483648 },
      { ...npc, notes: "x".repeat(2001) },
      { ...npc, attacks: Array.from({ length: 101 }, () => ({ ...attack, id: randomUUID() })) },
      { ...npc, attacks: [{ ...attack, damageBonus: 2147483648 }] },
      { ...npc, attacks: [{ ...attack, damageType: "x".repeat(101) }] },
    ];
    for (const invalid of invalidProfiles) {
      expect(
        (await fixture.request(`${path}/${id}`, "gm", "PUT", { expectedRevision: 0, npc: invalid }))
          .status,
      ).toBe(422);
    }
    const beforeConflict = await (await fixture.request(`${path}/${id}`, "gm")).json();
    expect(beforeConflict.npc).toMatchObject({ revision: 0, name: npc.name, attacks: [attack] });
    const foreignAttack = await fixture.request(`${foreignPath}/${otherId}`, "outsider", "PUT", {
      expectedRevision: 0,
      npc: { ...npc, attacks: [attack] },
    });
    expect(foreignAttack.status).toBe(422);
    const writes = await Promise.all(
      ["First", "Second"].map((name) =>
        fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 0,
          npc: { ...npc, name, attacks: [attack] },
        }),
      ),
    );
    expect(writes.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const saved = await (await fixture.request(`${path}/${id}`, "gm")).json();
    expect(saved.npc.revision).toBe(1);
    expect(["First", "Second"]).toContain(saved.npc.name);
    expect(saved.npc.attacks).toEqual([attack]);
    const unchanged = await (await fixture.request(`${foreignPath}/${otherId}`, "outsider")).json();
    expect(unchanged.npc.revision).toBe(0);
    expect(unchanged.npc.attacks).toEqual([]);
    const throwsPath = `/games/${fixture.ids.game}/throws`;
    const foreignThrow = await fixture.request(
      `/games/${fixture.ids.otherGame}/throws`,
      "outsider",
      "POST",
      {
        sourceThrowId: null,
        setup: {
          type: "npc-attribute",
          npcId: otherId,
          expectedRevision: 0,
          attributes: ["DEX"],
          dice: {},
          modifier: 0,
          redDice: [],
          redModifier: 0,
          note: "",
        },
      },
    );
    expect(foreignThrow.status).toBe(201);
    const foreignSource = (await foreignThrow.json()).throw.id;
    const beforeForeignReroll = await fixture.pool.query(
      "SELECT count(*) FROM throws WHERE game_id = $1",
      [fixture.ids.game],
    );
    const foreignReroll = await fixture.request(throwsPath, "gm", "POST", {
      sourceThrowId: foreignSource,
      setup: {
        type: "npc-attribute",
        npcId: id,
        expectedRevision: 1,
        attributes: ["DEX"],
        dice: {},
        modifier: 0,
        redDice: [],
        redModifier: 0,
        note: "",
      },
    });
    expect(foreignReroll.status).toBe(404);
    expect(
      (
        await fixture.pool.query("SELECT count(*) FROM throws WHERE game_id = $1", [
          fixture.ids.game,
        ])
      ).rows,
    ).toEqual(beforeForeignReroll.rows);
    const throwCount = await fixture.pool.query("SELECT count(*) FROM throws WHERE game_id = $1", [
      fixture.ids.game,
    ]);
    const invalidRolls = [
      {
        type: "npc-attack",
        npcId: id,
        attackId: randomUUID(),
        expectedRevision: 1,
        dice: [8, 8],
        modifier: 0,
        note: "",
      },
      {
        type: "npc-attack",
        npcId: otherId,
        attackId,
        expectedRevision: 1,
        dice: [8, 8],
        modifier: 0,
        note: "",
      },
      {
        type: "npc-attack",
        npcId: id,
        attackId,
        expectedRevision: 1,
        dice: [8, 8],
        modifier: 0,
        note: "",
        accuracyBonus: 99,
      },
    ];
    for (const setup of invalidRolls) {
      const response = await fixture.request(throwsPath, "gm", "POST", {
        sourceThrowId: null,
        setup,
      });
      expect([404, 422]).toContain(response.status);
    }
    expect(
      (
        await fixture.pool.query("SELECT count(*) FROM throws WHERE game_id = $1", [
          fixture.ids.game,
        ])
      ).rows,
    ).toEqual(throwCount.rows);
    const secondAttack = { ...attack, id: randomUUID(), name: "Bite" };
    expect(
      (
        await fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 1,
          npc: { ...npc, name: saved.npc.name, attacks: [secondAttack, attack] },
        })
      ).status,
    ).toBe(200);
    let reordered = await (await fixture.request(`${path}/${id}`, "gm")).json();
    expect(reordered.npc.attacks).toEqual([secondAttack, attack]);
    expect(
      (
        await fixture.request(`${path}/${id}`, "gm", "PUT", {
          expectedRevision: 2,
          npc: { ...npc, name: saved.npc.name, attacks: [attack] },
        })
      ).status,
    ).toBe(200);
    reordered = await (await fixture.request(`${path}/${id}`, "gm")).json();
    expect(reordered.npc.revision).toBe(3);
    expect(reordered.npc.attacks).toEqual([attack]);
    await fixture.pool.query("UPDATE players SET removed = true WHERE id = $1", [
      fixture.ids.member,
    ]);
    expect((await fixture.request(path, "player")).status).toBe(404);
    expect((await fixture.request(`${path}/${id}`, "player")).status).toBe(404);
    expect((await fixture.request(path, "player", "POST", { id: randomUUID(), npc })).status).toBe(
      404,
    );
  });
});
