import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "vite-plus/test";
import { randomUUID } from "node:crypto";
import { openAgentGame, setupAgentGame, type AgentWorld } from "../support/agent-game.ts";
import { editProvider } from "../support/agent-edits.ts";
import { seedAgentRolls } from "../support/agent-rolls.ts";
import { seedPool } from "../support/seed.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { AgentEditPage } from "../pages/agent-edit-page.ts";

interface EditWorld extends AgentWorld {
  review: AgentEditPage;
  agile: string;
}
Given(
  "the GM opens an Agent game with Robert at 10 HP and hidden Agile with a saved attack",
  async function (this: EditWorld) {
    await setupAgentGame(this, editProvider);
    this.review = new AgentEditPage(this.page);
    const pool = await seedPool();
    try {
      const game = this.agentGame;
      this.agile = (
        await seedAgentRolls(pool, game.gameId, game.gmCharacterId, game.playerCharacterId)
      ).agile;
      await pool.query("update characters set current_hp=10 where id=$1", [game.gmCharacterId]);
      await pool.query(
        "insert into npc_attacks(id,npc_id,position,name,reach,attribute_1,attribute_2,damage_bonus,damage_type) values($1,$2,0,'Claws','melee','DEX','MIG',4,'physical')",
        [randomUUID(), this.agile],
      );
    } finally {
      await pool.end();
    }
    await openAgentGame(this, "gm");
  },
);
When("reviews the proposed profile change", async function (this: EditWorld) {
  await this.review.review();
});
Then("the proposed diff reads {string}", async function (this: EditWorld, diff: string) {
  expect(await this.review.diff.innerText()).toBe(diff);
});
When("a second GM session changes Robert's HP to 9", async function (this: EditWorld) {
  const second = await this.browser!.newPage();
  try {
    const table = new GameTablePage(second);
    const { gm, gameId } = this.agentGame;
    await table.signIn(this.agentServer.url, gm.username, gm.password);
    await table.openGame(this.agentServer.url, gameId);
    const edit = new AgentEditPage(second);
    await edit.openCharacter("Robert");
    expect(await edit.changeHp(9)).toBe(200);
  } finally {
    await second.close();
  }
});
When("the GM accepts the stale character edit", async function (this: EditWorld) {
  expect(await this.review.accept("PATCH")).toBe(409);
});
Then(
  "the conflict refreshes the review to {string}",
  async function (this: EditWorld, diff: string) {
    expect(await this.review.notice.innerText()).toContain("revision changed");
    expect(await this.review.diff.innerText()).toBe(diff);
  },
);
When("the GM accepts the refreshed character edit", async function (this: EditWorld) {
  expect(await this.review.accept("PATCH")).toBe(200);
});
Then("Robert's sheet shows 8 HP after reload", async function (this: EditWorld) {
  await this.page.reload();
  await this.review.openCharacter("Robert");
  expect(await this.character.hp.inputValue()).toBe("8");
});
When("the GM dismisses the proposed profile change", async function (this: EditWorld) {
  await this.review.cancel();
});
Then("Agile still has the original notes", async function (this: EditWorld) {
  const pool = await seedPool();
  try {
    expect(
      (await pool.query("select notes from npcs where id=$1", [this.agile])).rows[0].notes,
    ).toBe("Hidden ambush");
  } finally {
    await pool.end();
  }
});
When("the GM accepts the reviewed NPC edit", async function (this: EditWorld) {
  expect(await this.review.accept("PUT")).toBe(200);
});
Then(
  "Agile's sheet shows the new notes, saved attack and hidden visibility after reload",
  async function (this: EditWorld) {
    await this.page.reload();
    expect(await this.review.npcProfile(this.agile)).toEqual({
      notes: "guarding the bridge",
      attack: "Claws",
      hidden: true,
    });
  },
);
