import { When, Then } from "@cucumber/cucumber";
import { expect } from "vite-plus/test";
import type { BrowserWorld } from "../support/world.ts";

When("I create character {string}", async function (this: BrowserWorld, name: string) {
  await this.game.createCharacter(name);
  await expect.poll(() => this.character.theme.isVisible()).toBe(true);
});

When("I return to the game table", async function (this: BrowserWorld) {
  await this.game.returnToGame();
});

When("I open character management", async function (this: BrowserWorld) {
  await this.game.openManagement();
});

When("I edit the character theme to {string} and HP to {int}", async function (this: BrowserWorld, theme: string, hp: number) {
  await this.character.editTheme(theme);
  await this.character.editHp(hp);
  await expect.poll(() => this.page.getByTestId("save-status").textContent()).toBe("Saved automatically");
});

When("I reload and reopen character {string}", async function (this: BrowserWorld, name: string) {
  await this.page.reload();
  await this.game.openManagement();
  await this.game.openCharacter(name);
  await expect.poll(() => this.character.theme.isVisible()).toBe(true);
});

Then("the character sheet shows theme {string} and HP {int}", async function (this: BrowserWorld, theme: string, hp: number) {
  expect(await this.character.theme.inputValue()).toBe(theme);
  expect(await this.character.hp.inputValue()).toBe(String(hp));
});

Then("character {string} is in the character list", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => this.game.character(name).isVisible()).toBe(true);
});

When("I set character {string} active", async function (this: BrowserWorld, name: string) {
  await this.game.toggleCharacter(name);
});

When("I set character {string} inactive", async function (this: BrowserWorld, name: string) {
  await this.game.toggleCharacter(name);
});

Then("character {string} is active", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => this.game.character(name).getByTestId("set-active").textContent()).toBe("Make inactive");
});

Then("character {string} is inactive", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => this.game.character(name).getByTestId("set-active").textContent()).toBe("Make active");
});
