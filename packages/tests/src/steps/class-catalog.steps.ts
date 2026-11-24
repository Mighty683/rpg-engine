import { Given, When, Then } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import { ClassCatalogPage } from "../pages/class-catalog-page.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { seedGame } from "../support/seed.ts";
import type { BrowserWorld } from "../support/world.ts";

Given(
  "I open the empty class library for my Fabula Ultima game at width {int}",
  async function (this: BrowserWorld, width: number) {
    const game = await seedGame({ gmWeapon: "none" });
    this.classGameId = game.gameId;
    this.classCatalog = new ClassCatalogPage(this.page);
    await this.page.setViewportSize({ width, height: 900 });
    await new GameTablePage(this.page).signIn(
      inject("frontendUrl"),
      game.gm.username,
      game.gm.password,
    );
    await this.classCatalog.openLibrary();
    await this.classCatalog.empty.waitFor();
  },
);

When(
  "I create template {string} with benefit {string} that says {string} and skill {string} ranked {int}",
  async function (
    this: BrowserWorld,
    name: string,
    benefit: string,
    effect: string,
    skill: string,
    rank: number,
  ) {
    await this.classCatalog.create(name);
    await this.classCatalog.addFreeBenefit(benefit, effect);
    await this.classCatalog.addSkill(skill, String(rank));
  },
);

When(
  "I copy {string} into my game and rename the library template {string}",
  async function (this: BrowserWorld, name: string, replacement: string) {
    await new GameTablePage(this.page).openGame(inject("frontendUrl"), this.classGameId);
    await this.classCatalog.openGameCatalog();
    await this.classCatalog.empty.waitFor();
    await this.classCatalog.copy(name);
    await this.classCatalog.backToList();
    await this.classCatalog.switchCatalog();
    await this.classCatalog.inspect(name);
    await this.classCatalog.rename(replacement);
    await this.classCatalog.backToList();
    await this.classCatalog.switchCatalog();
  },
);

Then(
  "my game's {string} still has effect {string} and skill {string} ranked {int} after reload",
  async function (this: BrowserWorld, name: string, effect: string, skill: string, rank: number) {
    await this.page.reload();
    await this.classCatalog.inspect(name);
    await this.page.reload();
    expect(await this.classCatalog.name.inputValue()).toBe(name);
    expect(await this.classCatalog.name.isEditable()).toBe(true);
    expect(await this.classCatalog.readBenefit()).toBe(effect);
    expect(await this.classCatalog.readSkill()).toEqual({ name: skill, rank: String(rank) });
    await this.classCatalog.backToList();
  },
);

When(
  "I save game class {string} as new template {string}",
  async function (this: BrowserWorld, name: string, template: string) {
    await this.classCatalog.saveNew(name, template);
  },
);

When(
  "I save game class {string} over library template {string}",
  async function (this: BrowserWorld, name: string, template: string) {
    await this.classCatalog.replace(name, template);
  },
);

Then(
  "my library contains {string} and {string} and the same {string} game copy remains",
  async function (this: BrowserWorld, first: string, second: string, copy: string) {
    const copyId = await this.classCatalog.entries
      .locator('[data-testid^="view-class-"]')
      .getAttribute("data-testid");
    await this.classCatalog.switchCatalog();
    await this.classCatalog.entries.first().waitFor();
    expect(await this.classCatalog.entries.count()).toBe(2);
    expect(await this.classCatalog.entries.allTextContents()).toEqual(
      expect.arrayContaining([expect.stringContaining(first), expect.stringContaining(second)]),
    );
    await this.classCatalog.switchCatalog();
    await this.classCatalog.entries.first().waitFor();
    expect(await this.classCatalog.entries.count()).toBe(1);
    expect(await this.classCatalog.entries.first().textContent()).toContain(copy);
    expect(
      await this.classCatalog.entries
        .locator('[data-testid^="view-class-"]')
        .getAttribute("data-testid"),
    ).toBe(copyId);
  },
);
