import { Given, When, Then } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import type { BrowserWorld } from "../support/world.ts";

Given("the games list is empty", async function (this: BrowserWorld) {
  await this.page.goto(inject("frontendUrl"));
  await expect.poll(() => this.games.emptyState.isVisible()).toBe(true);
  expect(await this.games.createButton.isVisible()).toBe(true);
  expect(
    await this.games.createButton.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
});

When(
  "I create game {string} with system {string}",
  async function (this: BrowserWorld, name: string, systemId: string) {
    await this.games.createGame(name, systemId);
  },
);

Then("creation of game {string} is confirmed", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => this.games.createdToast.textContent()).toBe(`Game created: ${name}.`);
});

Then("{string} is in the games list", async function (this: BrowserWorld, name: string) {
  await expect.poll(() => this.games.gameRow(name).isVisible()).toBe(true);
});

Then(
  "game {string} uses system {string}",
  async function (this: BrowserWorld, name: string, system: string) {
    const locator = this.games.gameSystem(name);
    const text = await locator.textContent();
    expect(text).toBe(`System: ${system}`);
  },
);
