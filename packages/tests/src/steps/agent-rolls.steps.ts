import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vite-plus/test";
import { setupAgentGame, openAgentGame, type AgentWorld } from "../support/agent-game.ts";
import { seedAgentRolls, rollProvider } from "../support/agent-rolls.ts";
import { seedPool } from "../support/seed.ts";
import { AgentRollPage } from "../pages/agent-roll-page.ts";

interface RollWorld extends AgentWorld {
  original?: { id: string };
}
async function results(w: AgentWorld) {
  const pool = await seedPool();
  try {
    return (
      await pool.query("select * from throws where game_id=$1 order by seq", [w.agentGame.gameId])
    ).rows;
  } finally {
    await pool.end();
  }
}
Given(
  "the GM opens the Agent with Robert, Christine, two hammers and hidden Agile",
  async function (this: RollWorld) {
    await setupAgentGame(this, rollProvider);
    const pool = await seedPool();
    try {
      await seedAgentRolls(
        pool,
        this.agentGame.gameId,
        this.agentGame.gmCharacterId,
        this.agentGame.playerCharacterId,
      );
    } finally {
      await pool.end();
    }
    await openAgentGame(this, "gm");
  },
);
When("the GM asks the Agent for {string}", async function (this: RollWorld, text: string) {
  await this.agent.ask(text);
});
Then("the Agent asks which hammer and history remains empty", async function (this: RollWorld) {
  await expect.poll(() => this.agent.transcript.innerText()).toContain("War Hammer, Light Hammer");
  expect(await results(this)).toHaveLength(0);
});
When("reviews the proposed roll", async function (this: RollWorld) {
  await new AgentRollPage(this.page).preview.waitFor();
});
Then(
  "the review identifies Robert, Agile and the War Hammer accuracy setup",
  async function (this: RollWorld) {
    const roll = new AgentRollPage(this.page);
    const text = await roll.preview.innerText();
    for (const part of ["Robert", "War Hammer", "Agile", "DEX d8 + MIG d10 +2"])
      expect(text).toContain(part);
  },
);
Then(
  "the review shows Christine with two current DEX d8 and the Tumbling note",
  async function (this: RollWorld) {
    const roll = new AgentRollPage(this.page);
    expect(await roll.preview.innerText()).toMatch(/Christine.*Tumbling/s);
    expect(await roll.preview.innerText()).toContain("DEX d8 + DEX d8");
  },
);
When("the GM confirms the proposed check", async function (this: RollWorld) {
  await new AgentRollPage(this.page).confirm();
});
Then(
  "one public accuracy result omits Agile and leaves its HP unchanged",
  async function (this: RollWorld) {
    const rows = await results(this);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "weapon-accuracy",
      private: false,
      character_name: "Robert",
      equipment_name: "War Hammer",
    });
    const pool = await seedPool();
    try {
      const npc = (
        await pool.query("select id,current_hp from npcs where game_id=$1 and name='Agile'", [
          this.agentGame.gameId,
        ])
      ).rows[0];
      expect(npc.current_hp).toBe(17);
      expect(JSON.stringify(rows)).not.toMatch(new RegExp("Agile|Hidden ambush|" + npc.id));
    } finally {
      await pool.end();
    }
  },
);
Then("one attribute result shows both faces and the total", async function (this: RollWorld) {
  const rows = await results(this);
  expect(rows).toHaveLength(1);
  expect(rows[0].setup.dice).toEqual([
    { label: "DEX", size: 8 },
    { label: "DEX", size: 8 },
  ]);
  const side = rows[0].outcome.first;
  const faces = side.dice.map((d: { face: number }) => d.face);
  expect(await new AgentRollPage(this.page).shownOutcome()).toEqual({
    faces,
    total: faces[0] + faces[1],
  });
  expect(side.total).toBe(side.dice[0].face + side.dice[1].face);
  expect(await new AgentRollPage(this.page).result.innerText()).not.toMatch(/success|failed/i);
});
When("makes the roll private and confirms", async function (this: RollWorld) {
  await new AgentRollPage(this.page).privacy.click();
  await new AgentRollPage(this.page).confirm();
});
Then("one private GM roll shows both d10 faces and their sum", async function (this: RollWorld) {
  const rows = await results(this);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "free",
    private: true,
    role: "GM",
    author_account_id: this.agentGame.gm.accountId,
  });
  const side = rows[0].outcome.first;
  expect(side.dice.map((d: { size: number }) => d.size)).toEqual([10, 10]);
  const faces = side.dice.map((d: { face: number }) => d.face);
  expect(await new AgentRollPage(this.page).shownOutcome()).toEqual({
    faces,
    total: faces[0] + faces[1],
  });
  expect(side.total).toBe(side.dice[0].face + side.dice[1].face);
  this.original = rows[0];
});
When("the GM stays in chat and requests {string}", async function (this: RollWorld, text: string) {
  await this.agent.ask(text);
});
When("confirms the proposed private reroll", async function (this: RollWorld) {
  expect(await new AgentRollPage(this.page).privacy.isChecked()).toBe(true);
  expect(await new AgentRollPage(this.page).confirm()).toBe(this.original?.id);
});
Then(
  "history preserves the first private result and adds a second",
  async function (this: RollWorld) {
    await expect.poll(() => this.page.getByTestId("agent-roll-result").count()).toBe(2);
    const rows = await results(this);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(this.original);
    expect(rows[1]).toMatchObject({ private: true, kind: "free", setup: rows[0].setup });
    expect(rows[1].id).not.toBe(rows[0].id);
    await this.page.reload();
    await this.agent.open();
    await expect.poll(() => this.page.getByTestId("agent-roll-result").count()).toBe(2);
    expect(await this.page.getByTestId("agent-make-roll").count()).toBe(0);
  },
);
