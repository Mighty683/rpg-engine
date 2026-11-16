import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import { CharacterProgressionPage } from "../pages/character-progression-page.ts";
import { ClassCatalogPage } from "../pages/class-catalog-page.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { seedGame, seedGameClass } from "../support/seed.ts";
import type { BrowserWorld } from "../support/world.ts";

Given(
  "the GM and player have a game open with a learned {string} skill in {string} at width {int}",
  async function (this: BrowserWorld, skill: string, name: string, width: number) {
    const game = await seedGame({ gmWeapon: "none" });
    this.progressionGame = game;
    this.progressionClass = await seedGameClass(game, {
      name,
      description: "",
      freeBenefits: [],
      skills: [
        {
          id: randomUUID(),
          name: skill,
          description: "",
          maxRank: 3,
          benefits: [
            {
              id: randomUUID(),
              name: "Parry",
              kind: "modifier",
              stat: "maxHp",
              amount: 6,
              perRank: true,
            },
          ],
        },
      ],
    });
    this.fallbackClass = await seedGameClass(game, {
      name: "Wayfarer",
      description: "",
      freeBenefits: [],
      skills: [],
    });
    this.livePlayerPage = await this.browser!.newPage({ viewport: { width, height: 900 } });
    this.livePlayerPage.setDefaultTimeout(8_000);
    const playerTable = new GameTablePage(this.livePlayerPage);
    this.liveProgression = new CharacterProgressionPage(this.livePlayerPage);
    const origin = inject("frontendUrl");
    await playerTable.signIn(origin, game.player.username, game.player.password);
    const live = this.livePlayerPage.waitForResponse(
      (response) =>
        response.url().endsWith(`/games/${game.gameId}/events`) && response.status() === 200,
    );
    if (width === 390) {
      await playerTable.openGame(origin, game.gameId);
      await this.liveProgression.open("Player Hero");
    } else {
      await this.liveProgression.openDirect(origin, game.gameId, game.playerCharacterId);
    }
    await live;
    await this.liveProgression.chooseClass(this.progressionClass.id);
    await this.liveProgression.waitUntilSaved();
    await this.liveProgression.selectSkill(
      this.progressionClass.id,
      this.progressionClass.definition.skills[0]!.id,
    );
    await this.liveProgression.waitUntilSaved();

    const gmTable = new GameTablePage(this.page);
    this.classCatalog = new ClassCatalogPage(this.page);
    await this.page.setViewportSize({ width, height: 900 });
    await gmTable.signIn(origin, game.gm.username, game.gm.password);
    await gmTable.openGame(origin, game.gameId);
    await this.classCatalog.openGameCatalog();
    await this.classCatalog.inspect(name);
  },
);

When(
  "the GM reviews affected ranks and cancels removing the learned skill",
  async function (this: BrowserWorld) {
    await this.classCatalog.requestSkillRemoval(this.progressionClass.definition.skills[0]!.id);
    expect(await this.classCatalog.affectedUsers.textContent()).toContain("Player Hero");
    expect(await this.classCatalog.affectedUsers.textContent()).toContain("Rank 1");
    await this.classCatalog.cancelSkillRemoval();
  },
);

Then("the class skill and the player's rank are unchanged", async function (this: BrowserWorld) {
  const { id } = this.progressionClass.definition.skills[0]!;
  expect(await this.classCatalog.skill(id).isVisible()).toBe(true);
  expect(await this.liveProgression.skillRank(id).getAttribute("aria-valuenow")).toBe("1");
  expect(await this.liveProgression.maximumHp.textContent()).toContain("41");
});

When("the GM confirms removal of the learned skill", async function (this: BrowserWorld) {
  await this.classCatalog.requestSkillRemoval(this.progressionClass.definition.skills[0]!.id);
  await this.classCatalog.confirmSkillRemoval();
});

Then(
  "the player's open sheet loses the skill and its modifier but keeps the class level and EXP",
  async function (this: BrowserWorld) {
    const { id, definition } = this.progressionClass;
    await this.liveProgression.skillRank(definition.skills[0]!.id).waitFor({ state: "hidden" });
    await this.liveProgression.maximumHp.filter({ hasText: "35" }).waitFor();
    expect(await this.liveProgression.classLevel(id).getAttribute("aria-valuenow")).toBe("1");
    expect(await this.liveProgression.currentExp.inputValue()).toBe("40");
    expect(await this.liveProgression.totalExp.inputValue()).toBe("50");
  },
);

When(
  "the GM clears the remaining assignment and removes the game class",
  async function (this: BrowserWorld) {
    const { gameId, playerCharacterId } = this.progressionGame;
    const origin = inject("frontendUrl");
    const gmSheet = new CharacterProgressionPage(this.page);
    await gmSheet.openDirect(origin, gameId, playerCharacterId);
    await gmSheet.lowerClass(this.progressionClass.id);
    await gmSheet.waitUntilSaved();
    await new GameTablePage(this.page).openGame(origin, gameId);
    await this.classCatalog.openGameCatalog();
    await this.classCatalog.deleteClass(this.progressionClass.id);
  },
);

Then(
  "the game class is absent from the catalog and class picker after reload",
  async function (this: BrowserWorld) {
    await this.page.reload();
    await this.classCatalog.entries
      .filter({ hasText: this.fallbackClass.definition.name })
      .waitFor();
    expect(
      await this.classCatalog.entries
        .filter({ hasText: this.progressionClass.definition.name })
        .count(),
    ).toBe(0);
    const { gameId, playerCharacterId } = this.progressionGame;
    await this.liveProgression.openDirect(inject("frontendUrl"), gameId, playerCharacterId);
    await this.liveProgression.addClass.click();
    await this.liveProgression.classOption(this.fallbackClass.id).waitFor();
    expect(await this.liveProgression.classOption(this.progressionClass.id).count()).toBe(0);
  },
);
