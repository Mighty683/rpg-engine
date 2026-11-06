import { When, Then } from "@cucumber/cucumber";
import { expect } from "vite-plus/test";
import type { BrowserWorld } from "../support/world.ts";

When("I open game {string}", async function (this: BrowserWorld, name: string) {
  await this.games.openGame(name);
  expect(this.page.url()).toMatch(/\/games\//);
});

When("I add player {string}", async function (this: BrowserWorld, name: string) {
  await this.game.addPlayer(name);
  await expect.poll(() => this.game.player(name).isVisible()).toBe(true);
});

When("I open player {string}", async function (this: BrowserWorld, name: string) {
  await this.game.player(name).click();
  expect(this.page.url()).toMatch(/\/players\//);
});

When("I create character {string}", async function (this: BrowserWorld, name: string) {
  await this.player.createCharacter(name);
  await expect.poll(() => this.character.name.isVisible()).toBe(true);
  expect(this.page.url()).toMatch(/\/characters\//);
});

When("I return to the player page", async function (this: BrowserWorld) {
  await this.page.goBack();
  expect(this.page.url()).toMatch(/\/players\//);
});

When(
  "I edit the character theme to {string} and HP to {int}",
  async function (this: BrowserWorld, theme: string, hp: number) {
    await this.character.editTheme(theme);
    await this.character.editHp(hp);
    await expect.poll(() => this.page.getByTestId("save-status").textContent()).toBe("Saved");
  },
);

When("I reload the character sheet", async function (this: BrowserWorld) {
  await this.page.reload();
  await expect.poll(() => this.character.name.isVisible()).toBe(true);
});

Then(
  "the character sheet shows theme {string} and HP {int}",
  async function (this: BrowserWorld, theme: string, hp: number) {
    expect(await this.character.theme.inputValue()).toBe(theme);
    expect(await this.character.hp.inputValue()).toBe(String(hp));
  },
);

Then(
  "character {string} is in the character list",
  async function (this: BrowserWorld, name: string) {
    await expect.poll(() => this.player.character(name).isVisible()).toBe(true);
  },
);

When("I set character {string} active", async function (this: BrowserWorld, name: string) {
  const card = this.player.character(name).locator("..");
  await card.getByTestId("set-active").click();
});

Then("character {string} is active", async function (this: BrowserWorld, name: string) {
  const card = this.player.character(name).locator("..");
  await expect.poll(() => card.getByTestId("active-character").isVisible()).toBe(true);
});

When("I clear the active character", async function (this: BrowserWorld) {
  await this.page.getByTestId("clear-active").click();
  await this.page.reload();
});

When("I open the game overview", async function (this: BrowserWorld) {
  await this.page.getByTestId("game-link").click();
  await expect.poll(() => this.page.getByTestId("game-heading").isVisible()).toBe(true);
});

Then(
  "player {string} shows active character {string}",
  async function (this: BrowserWorld, player: string, character: string) {
    const row = this.page
      .getByTestId("player-row-link")
      .filter({ hasText: `${player}${character}` });
    await expect.poll(() => row.isVisible()).toBe(true);
  },
);

Then("no character is active", async function (this: BrowserWorld) {
  const clear = this.page.getByTestId("clear-active");
  expect(await clear.count()).toBe(0);
});
