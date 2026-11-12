import { Given, Then, When } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import type { Page } from "playwright";
import type { BrowserWorld } from "../support/world.ts";
import { seedGame } from "../support/seed.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { NpcsPage } from "../pages/npcs-page.ts";

type LoadingWorld = BrowserWorld & { npcGameId: string; finishNpcLoading: () => void };

Given("the GM signs in to an NPC game", async function (this: BrowserWorld) {
  const game = await seedGame({});
  (this as LoadingWorld).npcGameId = game.gameId;
  await this.page.setViewportSize({ width: 390, height: 844 });
  await new GameTablePage(this.page).signIn(
    inject("frontendUrl") as string,
    game.gm.username,
    game.gm.password,
  );
});
When("the GM opens the game while the NPC list is loading", async function (this: BrowserWorld) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  (this as LoadingWorld).finishNpcLoading = release;
  await this.page.route("**/api/games/*/npcs", async (route) => {
    await gate;
    await route.continue();
  });
  await new GameTablePage(this.page).openGame(
    inject("frontendUrl") as string,
    (this as LoadingWorld).npcGameId,
  );
});
Then("the table shows an NPC loading indicator", async function (this: BrowserWorld) {
  try {
    await this.page.getByTestId("npc-loading").waitFor({ state: "visible" });
  } finally {
    (this as LoadingWorld).finishNpcLoading();
  }
  await this.page.getByTestId("npc-loading").waitFor({ state: "hidden" });
});

Given("the GM has an NPC game open", async function (this: BrowserWorld) {
  const game = await seedGame({});
  const table = new GameTablePage(this.page);
  const url = inject("frontendUrl") as string;
  await table.signIn(url, game.gm.username, game.gm.password);
  await table.openGame(url, game.gameId);
});
When("the GM creates an NPC named {string}", async function (this: BrowserWorld, name: string) {
  await new NpcsPage(this.page).create(name);
});
When("the GM makes a free roll as NPC {string}", async function (this: BrowserWorld, name: string) {
  await new NpcsPage(this.page).closeEditor();
  await new GameTablePage(this.page).openHistory();
  await this.page.getByTestId("make-roll").click();
  await this.page.getByTestId("roll-as").click();
  await this.page.getByTestId("roll-as-option-character").filter({ hasText: name }).click();
  await this.page.getByTestId("add-die-d8").click();
  await this.page.getByTestId("submit-free-roll").click();
});
Then(
  "the NPC free roll is attributed to {string}",
  async function (this: BrowserWorld, name: string) {
    await expect
      .poll(() =>
        this.page.getByTestId("throw-entry").last().getByTestId("throw-title").textContent(),
      )
      .toContain(name);
  },
);
Then("the NPC card shows {string}", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => new NpcsPage(this.page).card(name).count()).toBe(1);
});
When(
  "the GM sets NPC {string} level to {int} and notes to {string}",
  async function (this: BrowserWorld, npc: string, level: number, notes: string) {
    await new NpcsPage(this.page).setLevelAndNotes(npc, level, notes);
  },
);
Then(
  "NPC {string} card shows level {int} and notes {string}",
  async function (this: BrowserWorld, npc: string, level: number, notes: string) {
    const card = new NpcsPage(this.page).card(npc);
    await expect.poll(() => card.innerText()).toContain(`Lv ${level}`);
    await expect.poll(() => card.getByTestId("npc-notes").innerText()).toBe(notes);
  },
);
When("the GM sets NPC {string} stats", async function (this: BrowserWorld, npc: string) {
  await new NpcsPage(this.page).setStats(npc);
});
Then("NPC {string} shows the saved stats", async function (this: BrowserWorld, npc: string) {
  const page = new NpcsPage(this.page);
  await expect.poll(() => page.card(npc).getByTestId("npc-hp").innerText()).toContain("40");
  expect(await page.savedStats(npc)).toEqual({
    dex: "d12",
    ins: "d10",
    mig: "d10",
    wlp: "d10",
    maxHp: "60",
    maxMp: "50",
    hp: "40",
    mp: "30",
    defense: "9",
    magicDefense: "10",
  });
});
When("the GM reloads the NPC game", async function (this: BrowserWorld) {
  await this.page.reload();
});

Given("the GM and player have an NPC game open", async function (this: BrowserWorld) {
  const game = await seedGame({});
  const url = inject("frontendUrl") as string;
  const table = new GameTablePage(this.page);
  await table.signIn(url, game.gm.username, game.gm.password);
  await table.openGame(url, game.gameId);
  const context = await this.browser!.newContext();
  const player = await context.newPage();
  (this as BrowserWorld & { npcPlayer: Page }).npcPlayer = player;
  const playerTable = new GameTablePage(player);
  await playerTable.signIn(url, game.player.username, game.player.password);
  await playerTable.openGame(url, game.gameId);
});
Then("the player sees no NPC named {string}", async function (this: BrowserWorld, name: string) {
  const player = (this as BrowserWorld & { npcPlayer: Page }).npcPlayer;
  await expect.poll(() => new NpcsPage(player).card(name).count()).toBe(0);
});
When(
  "the GM changes the NPC visibility to {string}",
  async function (this: BrowserWorld, value: string) {
    await new NpcsPage(this.page).visibility(value);
  },
);
Then(
  "the player sees a concealed NPC named {string}",
  async function (this: BrowserWorld, name: string) {
    const card = new NpcsPage((this as BrowserWorld & { npcPlayer: Page }).npcPlayer).card(name);
    await expect.poll(() => card.count()).toBe(1);
    expect(await card.innerText()).toContain("???");
    expect(await card.innerText()).not.toContain("A private secret");
    expect(await card.getByTestId("edit-npc").count()).toBe(0);
  },
);
Then(
  "the player sees the known NPC named {string}",
  async function (this: BrowserWorld, name: string) {
    const card = new NpcsPage((this as BrowserWorld & { npcPlayer: Page }).npcPlayer).card(name);
    await expect
      .poll(async () => ((await card.count()) ? await card.innerText() : ""))
      .not.toContain("???");
    expect(await card.innerText()).toContain("DEX");
    expect(await card.innerText()).not.toContain("A private secret");
    expect(await card.getByTestId("edit-npc").count()).toBe(0);
  },
);
When("the GM rolls the NPC's DEX", async function (this: BrowserWorld) {
  await new NpcsPage(this.page).rollDex("Bandit");
});
Then(
  "the player sees {int} NPC rolls in history",
  async function (this: BrowserWorld, count: number) {
    const player = (this as BrowserWorld & { npcPlayer: Page }).npcPlayer;
    await new GameTablePage(player).openHistory();
    await expect
      .poll(() => player.getByTestId("throw-entry").filter({ hasText: "Bandit" }).count())
      .toBe(count);
  },
);
When("the player loses connection", async function (this: BrowserWorld) {
  const player = (this as BrowserWorld & { npcPlayer: Page }).npcPlayer;
  await player.context().setOffline(true);
});
When("the player reconnects and returns to the game", async function (this: BrowserWorld) {
  const player = (this as BrowserWorld & { npcPlayer: Page }).npcPlayer;
  await player.context().setOffline(false);
  await player.evaluate(() => window.dispatchEvent(new Event("focus")));
});

When("the GM adds an NPC attack named {string}", async function (this: BrowserWorld, name: string) {
  await new NpcsPage(this.page).addAttack(name);
});
Then(
  "the NPC attack {string} appears on the card",
  async function (this: BrowserWorld, name: string) {
    await expect.poll(() => new NpcsPage(this.page).attackVisible(name)).toBe(1);
  },
);

When(
  "the GM rolls and rerolls the NPC attack {string}",
  async function (this: BrowserWorld, name: string) {
    await new NpcsPage(this.page).rollAndRerollAttack(name);
  },
);
When(
  "the GM changes NPC {string} attack {string} to {string}",
  async function (this: BrowserWorld, npc: string, oldName: string, name: string) {
    await new NpcsPage(this.page).changeAttack(npc, oldName, name);
  },
);
When(
  "the GM removes NPC {string} attack {string}",
  async function (this: BrowserWorld, npc: string, name: string) {
    await new NpcsPage(this.page).removeAttack(npc, name);
  },
);
Then(
  "NPC {string} card no longer shows the attack {string}",
  async function (this: BrowserWorld, npc: string, name: string) {
    await expect.poll(() => new NpcsPage(this.page).card(npc).innerText()).not.toContain(name);
  },
);
Then("the NPC history contains two rolls", async function (this: BrowserWorld) {
  await expect.poll(() => this.page.getByTestId("throw-entry").count()).toBe(2);
});
When("the GM removes the NPC {string}", async function (this: BrowserWorld, name: string) {
  await new NpcsPage(this.page).remove(name);
});
Then("the NPC card no longer shows {string}", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => new NpcsPage(this.page).card(name).count()).toBe(0);
});

When("an NPC update fails after the GM changes its name", async function (this: BrowserWorld) {
  await this.page.setViewportSize({ width: 390, height: 844 });
  await new NpcsPage(this.page).failNameChange("Changed");
});
When(
  "the GM edits the NPC name to {string} using the keyboard",
  async function (this: BrowserWorld, name: string) {
    await new NpcsPage(this.page).editNameWithKeyboard(name);
  },
);
Then(
  "the NPC editor shows progress and blocks fields during an update",
  async function (this: BrowserWorld) {
    await new NpcsPage(this.page).inspectPendingUpdate();
  },
);
Then(
  "the NPC editor shows the saved name {string}",
  async function (this: BrowserWorld, name: string) {
    await expect.poll(() => this.page.getByTestId("npc-name").inputValue()).toBe(name);
    await this.page
      .getByText("NPC changes could not be saved. The latest version was restored.", {
        exact: true,
      })
      .waitFor({ state: "visible" });
  },
);
When("the GM closes the NPC editor with Escape", async function (this: BrowserWorld) {
  await this.page.getByTestId("npc-name").focus();
  await this.page.keyboard.press("Escape");
});
Then("focus returns to the NPC edit control", async function (this: BrowserWorld) {
  await expect
    .poll(() =>
      this.page.getByTestId("edit-npc").evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
});
