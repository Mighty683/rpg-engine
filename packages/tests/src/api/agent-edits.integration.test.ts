import { expect, it } from "vite-plus/test";
import { createApiFixture } from "./fixtures.ts";
import { editProvider } from "../support/agent-edits.ts";
import { seedAgentRolls } from "../support/agent-rolls.ts";

it("GM-API-05 prepares one review, preserves concurrent changes and persists no executable action", async () => {
  const f = await createApiFixture("agent_edits", { application: { agentProvider: editProvider } });
  const path = "/games/" + f.ids.game;
  const sheet = path + "/characters/" + f.ids.gmCharacter;
  try {
    const { agile } = await seedAgentRolls(
      f.pool,
      f.ids.game,
      f.ids.gmCharacter,
      f.ids.playerCharacter,
    );
    const state = async () => (await (await f.request(sheet, "gm")).json()).character;
    const start = await state();
    const prepare = async (message: string) => {
      const response = await f.request(path + "/agent/turns", "gm", "POST", { message });
      expect(response.status).toBe(200);
      return response.json();
    };
    const turn = await prepare("Set Robert's HP to 8 and Agile's notes to guarding the bridge");
    expect(turn.action).toEqual({
      kind: "edit_character",
      characterId: f.ids.gmCharacter,
      expectedRevision: start.revision,
      changes: { resources: { hp: 8 } },
    });
    expect((await state()).revision).toBe(start.revision);
    const commit = (changes: unknown) =>
      f.request(sheet, "gm", "PATCH", { expectedRevision: start.revision, changes });
    expect((await commit({ theme: "Intervening change" })).status).toBe(200);
    expect((await commit(turn.action.changes)).status).toBe(409);
    const current = await state();
    expect(current.sheet.theme).toBe("Intervening change");
    expect(current.sheet.resources.hp).toBe(start.sheet.resources.hp);
    const readNpc = async () =>
      (await (await f.request(path + "/npcs", "gm")).json()).npcs.find(
        (n: { id: string }) => n.id === agile,
      );
    const initialNpc = await readNpc();
    const npcTurn = await prepare("Set Agile's notes to guarding the bridge");
    expect(npcTurn.action).toEqual({
      kind: "edit_npc",
      npcId: agile,
      expectedRevision: initialNpc.revision,
      changes: { notes: "guarding the bridge" },
    });
    expect(await readNpc()).toEqual(initialNpc);
    const history = await (await f.request(path + "/agent/status", "gm")).json();
    expect(history.turns.map((row: { id: string }) => row.id)).toEqual([turn.id, npcTurn.id]);
    expect(history.turns.every((row: object) => !("action" in row))).toBe(true);
  } finally {
    await f.cleanup();
  }
});
