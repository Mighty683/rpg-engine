import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createApiFixture, type ApiFixture } from "./fixtures.ts";

describe("Authoritative transaction-bound roll readers", () => {
  let fixture: ApiFixture;
  beforeEach(async () => {
    fixture = await createApiFixture("roll_boundaries");
  });
  afterEach(async () => {
    await fixture?.cleanup();
  });

  async function history() {
    return (await fixture.pool.query("SELECT id, game_id, setup, outcome FROM throws ORDER BY id"))
      .rows;
  }

  it("rejects forged, foreign, inactive, stale and private character sources without history writes", async () => {
    const { ids, request, pool } = fixture;
    const path = `/games/${ids.game}/throws`;
    const setup = {
      type: "attribute",
      characterId: ids.playerCharacter,
      expectedRevision: 0,
      attributes: ["DEX"],
      dice: {},
      modifier: 0,
      redDice: [],
      redModifier: 0,
      note: "",
    };
    const valid = await request(path, "player", "POST", {
      sourceThrowId: null,
      private: true,
      setup,
    });
    expect(valid.status).toBe(201);
    const source = (await valid.json()).throw;
    expect(source).toMatchObject({
      characterId: ids.playerCharacter,
      characterName: "Player sheet",
      private: true,
      setup: { dice: [{ label: "DEX", size: 8 }] },
    });
    const before = await history();
    const rejected = [
      { actor: "player", setup: { ...setup, characterId: randomUUID() }, status: 404 },
      { actor: "player", setup: { ...setup, characterId: ids.foreignCharacter }, status: 404 },
      { actor: "gm", setup: { ...setup, characterId: ids.gmCharacter }, status: 409 },
      { actor: "player", setup: { ...setup, expectedRevision: 1 }, status: 409 },
      { actor: "player", setup: { ...setup, characterName: "forged" }, status: 422 },
      { actor: "gm", setup, status: 404, sourceThrowId: source.id },
    ];
    for (const item of rejected) {
      const response = await request(path, item.actor, "POST", {
        sourceThrowId: item.sourceThrowId ?? null,
        setup: item.setup,
      });
      expect(response.status).toBe(item.status);
      expect(await history()).toEqual(before);
    }
    await pool.query("UPDATE players SET active_character_id=NULL WHERE id=$1", [ids.member]);
    expect(
      (await request(path, "player", "POST", { sourceThrowId: source.id, setup })).status,
    ).toBe(409);
    expect(await history()).toEqual(before);
    await pool.query("UPDATE players SET active_character_id=$1 WHERE id=$2", [
      ids.playerCharacter,
      ids.member,
    ]);
    const reroll = await request(path, "player", "POST", { sourceThrowId: source.id, setup });
    expect(reroll.status).toBe(201);
    const snapshot = (await reroll.json()).throw;
    expect(snapshot.characterName).toBe(source.characterName);
    expect(snapshot.setup).toEqual(source.setup);
  });

  it("uses saved NPC stats and immutable attack snapshots while enforcing game, attack and revision boundaries", async () => {
    const { ids, request, pool } = fixture;
    const id = randomUUID();
    const otherId = randomUUID();
    const attackId = randomUUID();
    const otherAttackId = randomUUID();
    const npc = {
      name: "Sentinel",
      relationship: "enemy",
      visibility: "hidden",
      level: 20,
      baseDice: { DEX: 6, INS: 8, MIG: 10, WLP: 12 },
      hp: { current: 10, max: 10 },
      mp: { current: 5, max: 5 },
      defense: 8,
      magicDefense: 8,
      notes: "secret",
      attacks: [
        {
          id: attackId,
          name: "Spear",
          reach: "melee",
          attributes: ["DEX", "MIG"],
          damageBonus: 3,
          damageType: "physical",
        },
      ],
    };
    expect((await request(`/games/${ids.game}/npcs`, "gm", "POST", { id, npc })).status).toBe(201);
    expect(
      (
        await request(`/games/${ids.otherGame}/npcs`, "outsider", "POST", {
          id: otherId,
          npc: { ...npc, attacks: [{ ...npc.attacks[0], id: otherAttackId }] },
        })
      ).status,
    ).toBe(201);
    const path = `/games/${ids.game}/throws`;
    const setup = {
      type: "npc-attack",
      npcId: id,
      attackId,
      expectedRevision: 0,
      dice: [6, 10],
      modifier: 0,
      note: "",
    };
    const response = await request(path, "gm", "POST", { sourceThrowId: null, setup });
    expect(response.status).toBe(201);
    const source = (await response.json()).throw;
    expect(source).toMatchObject({
      characterName: "Sentinel",
      equipmentName: "Spear",
      setup: {
        npcId: id,
        attack: {
          id: attackId,
          name: "Spear",
          accuracyBonus: 2,
          damageBonus: 3,
          damageType: "physical",
        },
        attributes: ["DEX", "MIG"],
      },
    });
    const before = await history();
    for (const item of [
      { actor: "player", setup, status: 403 },
      { actor: "gm", setup: { ...setup, npcId: otherId }, status: 404 },
      { actor: "gm", setup: { ...setup, attackId: otherAttackId }, status: 404 },
      { actor: "gm", setup: { ...setup, expectedRevision: 1 }, status: 409 },
    ]) {
      expect(
        (await request(path, item.actor, "POST", { sourceThrowId: null, setup: item.setup }))
          .status,
      ).toBe(item.status);
      expect(await history()).toEqual(before);
    }
    // A private source remains inaccessible to a non-author GM.
    await pool.query("UPDATE throws SET private=true, author_account_id=$1 WHERE id=$2", [
      ids.player,
      source.id,
    ]);
    const privateState = await history();
    expect((await request(path, "gm", "POST", { sourceThrowId: source.id, setup })).status).toBe(
      404,
    );
    expect(await history()).toEqual(privateState);
    await pool.query("UPDATE throws SET private=false WHERE id=$1", [source.id]);
    expect(
      (
        await request(`/games/${ids.game}/npcs/${id}`, "gm", "PUT", {
          expectedRevision: 0,
          npc: {
            ...npc,
            level: 30,
            attacks: [{ ...npc.attacks[0], name: "Changed", damageBonus: 9 }],
          },
        })
      ).status,
    ).toBe(200);
    const reroll = await request(path, "gm", "POST", {
      sourceThrowId: source.id,
      setup: { ...setup, expectedRevision: 1 },
    });
    expect(reroll.status).toBe(201);
    const saved = (await reroll.json()).throw;
    expect(saved.setup.attack).toEqual(source.setup.attack);
    expect(saved.setup.attributes).toEqual(source.setup.attributes);
    const original = (await pool.query("SELECT setup FROM throws WHERE id=$1", [source.id]))
      .rows[0];
    expect(original.setup).toEqual(source.setup);
  });
});
