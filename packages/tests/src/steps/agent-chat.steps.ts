import { After, Given, Then, When } from "@cucumber/cucumber";
import { expect } from "vite-plus/test";
import { randomUUID } from "node:crypto";
import { openAgentGame, setupAgentGame, type AgentWorld } from "../support/agent-game.ts";
import { AgentPage } from "../pages/agent-page.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { tableReaderProvider } from "../support/agent-provider.ts";
import { seedGameClass, seedPool } from "../support/seed.ts";

async function seedTurns(w: AgentWorld, count: number) {
  const pool = await seedPool();
  try {
    for (let i = 1; i <= count; i++)
      await pool.query(
        "INSERT INTO agent_turns(id,game_id,gm_account_id,author,message,reply,tools) VALUES ($1,$2,$3,'GM',$4,$5,'[]')",
        [
          randomUUID(),
          w.agentGame.gameId,
          w.agentGame.gm.accountId,
          "Question " + i,
          "Answer " + i,
        ],
      );
  } finally {
    await pool.end();
  }
}

After(async function (this: AgentWorld) {
  await this.agentServer?.close();
});

Given("the Agent game has Robert and Christine at the table", async function (this: AgentWorld) {
  await setupAgentGame(this);
});
When(
  "the GM opens the Agent game at {int} pixels wide",
  async function (this: AgentWorld, width: number) {
    await openAgentGame(this, "gm", width);
  },
);
When("asks the Agent who is in the party with Enter", async function (this: AgentWorld) {
  await this.agent.draft.fill("Who is in the party?");
  await expect.poll(() => this.agent.send.isEnabled()).toBe(true);
  await this.agent.draft.press("Enter");
  await expect.poll(() => this.agent.transcript.innerText()).toContain("Robert");
});
When("keeps a draft while visiting Throw history", async function (this: AgentWorld) {
  await this.agent.draft.fill("Tell me more");
  await this.agent.close();
  const table = new GameTablePage(this.page);
  await table.openHistory();
  await table.closeHistory();
  await this.agent.open();
});
Then(
  "the party reply and draft are visible in the compact chat",
  async function (this: AgentWorld) {
    expect(await this.agent.draft.inputValue()).toBe("Tell me more");
    const text = await this.agent.transcript.innerText();
    expect(text).toContain("Robert");
    expect(text).toContain("Christine");
    const bounds = await this.agent.draft.evaluate((el) =>
      el.closest('[role="dialog"]')!.getBoundingClientRect().toJSON(),
    );
    expect(bounds.width).toBe(Math.min(360, this.page.viewportSize()!.width - 24));
    expect(bounds.height).toBe(420);
    expect(bounds.left).toBe(12);
    expect(bounds.bottom).toBe(this.page.viewportSize()!.height - 12);
  },
);
Given("the Agent backend is disabled", function (this: AgentWorld) {
  this.agentServer.restart();
});
When("writes a draft while the Agent is unavailable", async function (this: AgentWorld) {
  await this.page.getByTestId("agent-offline").waitFor();
  await this.agent.draft.fill("Who is in the party?");
  expect(await this.agent.send.isEnabled()).toBe(false);
});
Then("reopening the chat preserves the unavailable draft", async function (this: AgentWorld) {
  await this.agent.close();
  await this.agent.open();
  expect(await this.agent.draft.inputValue()).toBe("Who is in the party?");
  expect(await this.agent.send.isEnabled()).toBe(false);
});
When("the Agent becomes available and the GM submits the draft", async function (this: AgentWorld) {
  this.agentServer.restart(tableReaderProvider);
  await this.agent.send.click();
});
Then(
  "the completed party turn appears once and clears the submitted draft",
  async function (this: AgentWorld) {
    await expect.poll(() => this.agent.draft.inputValue()).toBe("");
    await expect.poll(() => this.agent.transcript.innerText()).toContain("Christine");
    expect(await this.agent.transcript.locator("[data-message-id]").count()).toBe(2);
  },
);
Given(
  "the Agent backend restarts with {int} completed turns",
  async function (this: AgentWorld, count: number) {
    await seedTurns(this, count);
    this.agentServer.restart(tableReaderProvider);
  },
);
Then(
  "chat opens at the bottom of the latest 20 completed turns",
  async function (this: AgentWorld) {
    await expect.poll(() => this.agent.transcript.locator("[data-message-id]").count()).toBe(40);
    expect(await this.agent.atBottom()).toBe(true);
    expect(await this.agent.transcript.locator("[data-message-id]").first().innerText()).toContain(
      "Question 26",
    );
  },
);
When("the GM scrolls to the beginning of the loaded chat", async function (this: AgentWorld) {
  this.reading = await this.agent.transcript.evaluate((el) => {
    el.scrollTop = 0;
    const node = el.querySelector<HTMLElement>("[data-message-id]")!;
    return {
      first: node.dataset.messageId,
      offset: Math.round(node.getBoundingClientRect().top - el.getBoundingClientRect().top),
    };
  });
});
Then("the older turns appear above the same visible message", async function (this: AgentWorld) {
  await expect.poll(() => this.agent.transcript.locator("[data-message-id]").count()).toBe(80);
  await expect.poll(() => this.agent.readingPosition()).toEqual(this.reading);
});
When("the GM completes a turn in a second session", async function (this: AgentWorld) {
  const second = await this.browser!.newPage();
  try {
    const table = new GameTablePage(second);
    await table.signIn(
      this.agentServer.url,
      this.agentGame.gm.username,
      this.agentGame.gm.password,
    );
    await table.openGame(this.agentServer.url, this.agentGame.gameId);
    const agent = new AgentPage(second);
    await agent.open();
    await agent.ask("Who is in the party?");
    await expect.poll(() => agent.transcript.innerText()).toContain("Christine");
  } finally {
    await second.close();
  }
});
Then("the first session stays at its reading position", async function (this: AgentWorld) {
  // The other session's turn arrives on the panel's two-second refresh.
  await expect
    .poll(() => this.agent.transcript.locator("[data-message-id]").count(), { timeout: 6000 })
    .toBe(82);
  expect(await this.agent.readingPosition()).toEqual(this.reading);
});
When(
  "the GM loads the remaining five turns and returns to the bottom",
  async function (this: AgentWorld) {
    await this.agent.scrollTop();
    await expect.poll(() => this.agent.transcript.locator("[data-message-id]").count()).toBe(92);
    await this.agent.scrollBottom();
  },
);
Then("all 46 turns appear once in chronological order", async function (this: AgentWorld) {
  const lines = await this.agent.transcript.locator("[data-message-id]").allTextContents();
  for (let i = 1; i <= 45; i++) {
    expect(lines[(i - 1) * 2]).toContain("Question " + i);
    expect(lines[(i - 1) * 2 + 1]).toContain("Answer " + i);
  }
  expect(lines.at(-1)).toContain("Robert");
  expect(await this.agent.atBottom()).toBe(true);
});
Given("Robert learned an accuracy skill and a damage skill", async function (this: AgentWorld) {
  const skills = [
    {
      id: randomUUID(),
      name: "Steady aim",
      description: "On an aimed shot spend 2 MP for +1 accuracy.",
      maxRank: 1,
      benefits: [],
    },
    {
      id: randomUUID(),
      name: "Impact",
      description: "After a hit add 2 damage.",
      maxRank: 1,
      benefits: [],
    },
  ];
  const cls = await seedGameClass(this.agentGame, {
    name: "Hunter",
    description: "",
    freeBenefits: [],
    skills,
  });
  const pool = await seedPool();
  try {
    const ids = [this.agentGame.gameId, this.agentGame.gmCharacterId, cls.id];
    await pool.query(
      "INSERT INTO character_class_levels(game_id,character_id,game_class_id,level) VALUES ($1,$2,$3,2)",
      ids,
    );
    for (const skill of cls.definition.skills)
      await pool.query(
        "INSERT INTO character_skill_ranks(game_id,character_id,game_class_id,skill_id,rank) VALUES ($1,$2,$3,$4,1)",
        [...ids, skill.id],
      );
  } finally {
    await pool.end();
  }
});
When("asks {string}", async function (this: AgentWorld, message: string) {
  await this.agent.ask(message);
});
Then(
  "the Agent reads Robert's skills and explains the accuracy trigger and cost",
  async function (this: AgentWorld) {
    await expect.poll(() => this.agent.transcript.innerText()).toContain("Steady aim");
    expect(await this.agent.transcript.innerText()).toContain(
      "On an aimed shot spend 2 MP for +1 accuracy.",
    );
    expect(await this.page.getByTestId("agent-tool-call").innerText()).toContain("Robert");
  },
);
Given("the GM has a saved Agent conversation", async function (this: AgentWorld) {
  await seedTurns(this, 1);
});
When("the player opens the Agent game", async function (this: AgentWorld) {
  this.agentRequests = 0;
  this.page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith(`/api/games/${this.agentGame.gameId}/agent/`))
      this.agentRequests++;
  });
  await openAgentGame(this, "player");
});
Then(
  "the player sees the party and no Agent chat or history request",
  async function (this: AgentWorld) {
    await this.page.getByTestId("party-list").waitFor();
    expect(await this.agent.launcher.count()).toBe(0);
    expect(this.agentRequests).toBe(0);
  },
);

Then(
  "a pending message appears immediately and a rejected send removes it and shows an error",
  async function (this: AgentWorld) {
    const gate = Promise.withResolvers<void>();
    await this.page.route("**/agent/turns", async (route) => {
      await gate.promise;
      await route.fulfill({
        status: 502,
        json: { error: { code: "ERR05" } },
      });
    });
    try {
      await this.agent.ask("Rowan attack Mira");
      expect(await this.agent.draft.inputValue()).toBe("");
      expect(await this.agent.transcript.innerText()).toContain("Rowan attack Mira");
      await this.agent.draft.fill("Next question");
    } finally {
      gate.resolve();
    }
    await this.page.getByText("Could not complete the Agent turn", { exact: true }).waitFor();
    expect(await this.agent.transcript.innerText()).not.toContain("Rowan attack Mira");
    expect(await this.agent.draft.inputValue()).toBe("Next question");
  },
);
