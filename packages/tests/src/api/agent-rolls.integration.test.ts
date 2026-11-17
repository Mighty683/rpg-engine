import { expect, it } from "vite-plus/test";
import { createApiFixture } from "./fixtures.ts";
import { agentTool } from "../support/agent-provider.ts";
import { seedAgentRolls } from "../support/agent-rolls.ts";

it("GM-API-04 prepares canonical rolls and requires explicit ordinary submission", async () => {
  let args: Record<string, unknown> = {};
  const f = await createApiFixture("agent_rolls", {
    application: {
      agentProvider: {
        async complete() {
          // A model that keeps requesting preparation must still yield a single review.
          return agentTool("prepare_throw", args);
        },
      },
    },
  });
  try {
    const { warHammer, agile } = await seedAgentRolls(
      f.pool,
      f.ids.game,
      f.ids.gmCharacter,
      f.ids.playerCharacter,
    );
    const path = "/games/" + f.ids.game;
    async function prepare(input: Record<string, unknown>, message = "Prepare this roll") {
      args = input;
      const result = await f.request(path + "/agent/turns", "gm", "POST", { message });
      expect(result.status).toBe(200);
      return (await result.json()).action;
    }
    const weapon = {
      kind: "weapon",
      actor: "Robert",
      target: "Agile",
      weapon: "War Hammer",
      note: "Agile",
    };
    const prepared = await prepare(weapon, "Robert attacks Agile with War Hammer");
    expect(prepared).toMatchObject({
      kind: "roll",
      targetLabel: "Agile",
      input: {
        private: false,
        sourceThrowId: null,
        setup: {
          type: "weapon",
          characterId: f.ids.gmCharacter,
          expectedRevision: expect.any(Number),
          equipmentId: warHammer,
          dice: [8, 10],
          modifier: 0,
          note: "",
        },
      },
    });
    await f.pool.query("update character_equipment set accuracy_attribute_2=null where id=$1", [
      warHammer,
    ]);
    expect(await prepare(weapon)).toBeUndefined();
    await f.pool.query("update character_equipment set accuracy_attribute_2='MIG' where id=$1", [
      warHammer,
    ]);
    const check = {
      kind: "attribute",
      actor: "Christine",
      attributes: ["DEX"],
      target: "",
      weapon: "",
      note: "Agility check for tumbling",
    };
    const proposed = await prepare(check, "Christine make check roll for agility when tumbling");
    expect(proposed.input.setup).toMatchObject({
      type: "attribute",
      characterId: f.ids.playerCharacter,
      expectedRevision: expect.any(Number),
      attributes: ["DEX", "DEX"],
      dice: { DEX: 8 },
      note: "Tumbling",
      modifier: 0,
    });
    expect(
      (await prepare({ ...check, attributes: ["DEX", "INS"] })).input.setup.attributes,
    ).toEqual(["DEX", "INS"]);
    expect((await prepare({ kind: "free", dice: [10, 10] })).input).toEqual({
      private: false,
      sourceThrowId: null,
      setup: {
        type: "free",
        characterId: "gm",
        dice: [10, 10],
        redDice: [],
        redModifier: 0,
        modifier: 0,
        note: "",
      },
    });
    expect(await prepare({ kind: "free", dice: [10, 10, 10] })).toBeUndefined();
    const throws = () => f.pool.query("select * from throws where game_id=$1", [f.ids.game]);
    expect((await throws()).rowCount).toBe(0);
    const accepted = await f.request(path + "/throws", "gm", "POST", prepared.input);
    expect(accepted.status).toBe(201);
    expect((await throws()).rows).toHaveLength(1);
    expect(JSON.stringify((await throws()).rows)).not.toMatch(
      new RegExp("Agile|Hidden ambush|" + agile),
    );
    expect(
      (await f.pool.query("select current_hp from npcs where id=$1", [agile])).rows[0].current_hp,
    ).toBe(17);
  } finally {
    await f.cleanup();
  }
});

it("clarifies a missing named weapon and prepares unarmed attacks for confirmation", async () => {
  let calls = 0;
  let weapon: string | undefined = "Hammer";
  const f = await createApiFixture("agent_missing_weapon", {
    application: {
      agentProvider: {
        async complete() {
          calls++;
          return agentTool("prepare_throw", {
            kind: "weapon",
            actor: "Christine",
            target: "Agile",
            weapon,
          });
        },
      },
    },
  });
  try {
    await seedAgentRolls(f.pool, f.ids.game, f.ids.gmCharacter, f.ids.playerCharacter);
    const result = await f.request("/games/" + f.ids.game + "/agent/turns", "gm", "POST", {
      message: "Christine attacks Agile with a hammer",
    });
    expect(result.status).toBe(200);
    const turn = await result.json();
    expect(turn.reply).toContain("Christine has no weapon");
    expect(turn.action).toBeUndefined();
    expect(calls).toBe(1);
    for (weapon of [undefined, "Unarmed"]) {
      const res = await f.request("/games/" + f.ids.game + "/agent/turns", "gm", "POST", {
        message: "Attack Agile without a weapon",
      });
      expect(res.status).toBe(200);
      const { action, id } = await res.json();
      expect(action).toMatchObject({
        kind: "roll",
        targetLabel: "Agile",
        input: {
          setup: {
            type: "attribute",
            characterId: f.ids.playerCharacter,
            attributes: ["DEX", "MIG"],
            dice: { DEX: 8, MIG: expect.any(Number) },
            note: "Unarmed strike",
          },
        },
      });
      expect((await f.pool.query("select * from throws")).rowCount).toBe(0);
      if (weapon === "Unarmed") {
        const path = "/games/" + f.ids.game + "/throws";
        const input = { ...action.input, agentTurnId: id };
        expect((await f.request(path, "player", "POST", input)).status).toBe(403);
        const [first, retry] = await Promise.all([
          f.request(path, "gm", "POST", input),
          f.request(path, "gm", "POST", input),
        ]);
        expect(first.status).toBe(201);
        expect(retry.status).toBe(201);
        expect(await first.json()).toEqual(await retry.json());
        const { rows } = await f.pool.query("select setup from throws");
        expect(rows).toHaveLength(1);
        expect(rows[0].setup.note).toBe("Unarmed strike");
      }
    }
  } finally {
    await f.cleanup();
  }
});
