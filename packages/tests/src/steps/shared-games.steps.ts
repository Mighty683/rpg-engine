import { Given, When, Then } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import type { Page } from "playwright";
import { GameTablePage } from "../pages/game-table-page.ts";
import {
  seedAccount,
  seedGame,
  seedMember,
  seedPool,
  type SeededAccount,
} from "../support/seed.ts";
import type { BrowserWorld } from "../support/world.ts";

interface SharedGameWorld extends BrowserWorld {
  tables: Map<string, GameTablePage>;
  foreignGame: { name: string; id: string };
  linkStatus: number;
}

async function signIn(page: Page, account: SeededAccount) {
  const table = new GameTablePage(page);
  await table.signIn(inject("frontendUrl"), account.username, account.password);
  return table;
}

async function openPlayerTable(page: Page, account: SeededAccount, gameId: string) {
  const table = await signIn(page, account);
  await table.openGame(inject("frontendUrl"), gameId);
  await table.openHistory();
  return table;
}

Given(
  "players {string} and {string} have the same game open in separate sessions",
  async function (this: SharedGameWorld, first: string, second: string) {
    const game = await seedGame({ playerName: first });
    const other = await seedAccount();
    const pool = await seedPool();
    try {
      await seedMember(pool, game.gameId, other, [second]);
    } finally {
      await pool.end();
    }
    this.tables = new Map([
      [first, await openPlayerTable(this.page, game.player, game.gameId)],
      [second, await openPlayerTable(await this.browser!.newPage(), other, game.gameId)],
    ]);
  },
);

When("{string} rolls {string}", async function (this: SharedGameWorld, name: string, note: string) {
  await this.tables.get(name)!.rollWithNote(note);
});

Then(
  "both players see {string} rolled by {string}",
  async function (this: SharedGameWorld, note: string, name: string) {
    for (const table of this.tables.values()) {
      await expect.poll(() => table.rollTitle(note).textContent()).toContain(`Player · ${name} ·`);
    }
  },
);

Given(
  "I run {string} as GM and play {string} as {string}",
  async function (this: BrowserWorld, first: string, second: string, name: string) {
    const home = await seedGame({ name: first, gmName: "Warden" });
    await seedGame({ name: second, player: home.gm, playerName: name });
    await signIn(this.page, home.gm);
  },
);

When("I choose {string} from my games", async function (this: BrowserWorld, name: string) {
  await this.games.openGame(name);
});

When("I switch to {string} through my games", async function (this: BrowserWorld, name: string) {
  await new GameTablePage(this.page).closeHistory();
  await this.games.returnToGames();
  await this.games.openGame(name);
});

Then(
  "I see GM settings and {string} in the party",
  async function (this: BrowserWorld, name: string) {
    const table = new GameTablePage(this.page);
    await table.partyCard(name).waitFor();
    expect(await table.settings.isVisible()).toBe(true);
  },
);

Then(
  "I see player controls for {string} and no {string} in the party",
  async function (this: BrowserWorld, own: string, foreign: string) {
    const table = new GameTablePage(this.page);
    await expect.poll(() => table.featuredCharacter.textContent()).toContain(own);
    expect(await table.settings.count()).toBe(0);
    expect(await table.partyCard(foreign).count()).toBe(0);
  },
);

When("I roll {string}", async function (this: BrowserWorld, note: string) {
  await new GameTablePage(this.page).rollWithNote(note);
});

async function expectOnlyRoll(table: GameTablePage, note: string) {
  await table.openHistory();
  await expect.poll(() => table.historyNotes()).toEqual([note]);
  expect(await table.throwEntries().count()).toBe(1);
}

Then("my history contains only {string}", async function (this: BrowserWorld, note: string) {
  await expectOnlyRoll(new GameTablePage(this.page), note);
});

Given(
  "{string} plays in {string} and {string} plays separately in {string}",
  async function (
    this: SharedGameWorld,
    first: string,
    homeName: string,
    second: string,
    foreignName: string,
  ) {
    const home = await seedGame({ name: homeName, playerName: first });
    const foreign = await seedGame({ name: foreignName, playerName: second });
    this.foreignGame = { name: foreignName, id: foreign.gameId };
    this.tables = new Map([
      [first, await openPlayerTable(this.page, home.player, home.gameId)],
      [
        second,
        await openPlayerTable(await this.browser!.newPage(), foreign.player, foreign.gameId),
      ],
    ]);
  },
);

Then(
  "{string} sees only {string} in history",
  async function (this: SharedGameWorld, player: string, note: string) {
    await expectOnlyRoll(this.tables.get(player)!, note);
  },
);

When("{string} returns to the games list", async function (this: SharedGameWorld, player: string) {
  const table = this.tables.get(player)!;
  await table.closeHistory();
  await this.games.returnToGames();
});

Then("{string} is absent from my games", async function (this: BrowserWorld, name: string) {
  expect(await this.games.gameRow(name).count()).toBe(0);
});

When(
  "I follow the direct table link for {string}",
  async function (this: SharedGameWorld, name: string) {
    expect(this.foreignGame.name).toBe(name);
    this.linkStatus = await new GameTablePage(this.page).followGameLink(
      inject("frontendUrl"),
      this.foreignGame.id,
    );
  },
);

Then("the game is unavailable and its table is hidden", async function (this: SharedGameWorld) {
  expect(this.linkStatus).toBe(404);
  expect(await new GameTablePage(this.page).table.count()).toBe(0);
});
