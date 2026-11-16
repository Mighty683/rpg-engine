import { randomUUID } from "node:crypto";
import { Given, When, Then } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import { CharacterProgressionPage } from "../pages/character-progression-page.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { seedGame, seedGameClass, setPlayerActiveCharacter } from "../support/seed.ts";
import type { BrowserWorld } from "../support/world.ts";

Given(
  "I play in a game with {string} available and another party member at width {int}",
  async function (this: BrowserWorld, name: string, width: number) {
    this.progressionGame = await seedGame({ gmWeapon: "none" });
    await setPlayerActiveCharacter(this.progressionGame, null);
    this.progressionClass = await seedGameClass(this.progressionGame, {
      name,
      description: "",
      freeBenefits: [
        { id: randomUUID(), kind: "modifier", name: "Toughness", stat: "maxHp", amount: 7 },
      ],
      skills: [
        { id: randomUUID(), name: "Deflect", description: "Stand firm.", maxRank: 3, benefits: [] },
      ],
    });
    const { gameId, player } = this.progressionGame;
    const table = new GameTablePage(this.page);
    await this.page.setViewportSize({ width, height: 900 });
    await table.signIn(inject("frontendUrl"), player.username, player.password);
    await table.openGame(inject("frontendUrl"), gameId);
    this.progression = new CharacterProgressionPage(this.page);
  },
);

When(
  "I create and open the sheet for {string} from the party",
  async function (this: BrowserWorld, name: string) {
    this.progressionName = name;
    await this.progression.create(name);
    await this.progression.open(name);
  },
);

Then(
  "my sheet starts at level 5 with 50 of 50 EXP and other party sheets have no progression controls",
  async function (this: BrowserWorld) {
    expect(await this.progression.level.inputValue()).toBe("5");
    expect(await this.progression.currentExp.inputValue()).toBe("50");
    expect(await this.progression.totalExp.inputValue()).toBe("50");
    await this.progression.switchTo(this.progressionGame.gmCharacterId);
    await this.progression.sheet
      .filter({ hasText: "You can view this sheet but cannot edit it." })
      .waitFor();
    expect(await this.progression.addClass.count()).toBe(0);
    expect(await this.progression.currentExp.count()).toBe(0);
    await this.progression.close();
    await this.progression.open(this.progressionName);
  },
);

When("I assign my first class and learn its first skill", async function (this: BrowserWorld) {
  const { id, definition } = this.progressionClass;
  await this.progression.chooseClass(id);
  await this.progression.waitUntilSaved();
  await this.progression.selectSkill(id, definition.skills[0]!.id);
  await this.progression.waitUntilSaved();
});

Then(
  "my sheet and party show its benefit and I have rank 1 with 40 of 50 EXP",
  async function (this: BrowserWorld) {
    expect(
      await this.progression
        .skillRank(this.progressionClass.definition.skills[0]!.id)
        .getAttribute("aria-valuenow"),
    ).toBe("1");
    expect(await this.progression.currentExp.inputValue()).toBe("40");
    expect(await this.progression.totalExp.inputValue()).toBe("50");
    expect(await this.progression.maximumHp.textContent()).toContain("42");
    await this.progression.close();
    await this.progression.partyHp(this.progressionName).filter({ hasText: "35 / 42" }).waitFor();
    await this.progression.inspectPartyClass(this.progressionName);
    await this.progression.skillRank(this.progressionClass.definition.skills[0]!.id).waitFor();
    await this.progression.dismissPartyClass();
    await this.progression.open(this.progressionName);
  },
);

When(
  "I change my level, clear the rank, and refund the assigned class level",
  async function (this: BrowserWorld) {
    const { id, definition } = this.progressionClass;
    await this.progression.changeLevel("6");
    expect(await this.progression.currentExp.inputValue()).toBe("40");
    await this.progression.expandClass(id);
    await this.progression.lowerSkill(definition.skills[0]!.id);
    await this.progression.waitUntilSaved();
    expect(await this.progression.currentExp.inputValue()).toBe("40");
    await this.progression.lowerClass(id);
    await this.progression.waitUntilSaved();
  },
);

Then(
  "my level and 50 of 50 EXP persist and the class benefit is gone",
  async function (this: BrowserWorld) {
    await this.progression.reload();
    await this.progression.partyHp(this.progressionName).filter({ hasText: "35 / 36" }).waitFor();
    await this.progression.open(this.progressionName);
    expect(await this.progression.classCard(this.progressionClass.id).count()).toBe(0);
    expect(await this.progression.level.inputValue()).toBe("6");
    expect(await this.progression.currentExp.inputValue()).toBe("50");
    expect(await this.progression.totalExp.inputValue()).toBe("50");
  },
);

When(
  "the save response is lost after my first class allocation commits",
  async function (this: BrowserWorld) {
    const { committed, dropResponse } = await this.progression.loseNextSaveResponse();
    try {
      await this.progression.chooseClass(this.progressionClass.id);
      expect(await committed).toBe(200);
      await this.progression.saving.waitFor();
      expect(await this.progression.currentExp.inputValue()).toBe("40");
    } finally {
      dropResponse();
    }
  },
);

Then(
  "the optimistic class and 40 of 50 EXP remain visible with a reload action",
  async function (this: BrowserWorld) {
    await this.progression.reloadAction.waitFor();
    expect(await this.progression.classCard(this.progressionClass.id).isVisible()).toBe(true);
    expect(await this.progression.currentExp.inputValue()).toBe("40");
    expect(await this.progression.totalExp.inputValue()).toBe("50");
  },
);

When("I reload the saved sheet through the offered action", async function (this: BrowserWorld) {
  await this.progression.reloadAction.click();
  await this.progression.waitUntilSaved();
  await this.page.unroute("**/api/games/*/characters/*");
});

Then(
  "the saved class stays available, EXP was charged once, and I can still edit",
  async function (this: BrowserWorld) {
    expect(await this.progression.classCard(this.progressionClass.id).isVisible()).toBe(true);
    expect(await this.progression.currentExp.inputValue()).toBe("40");
    expect(await this.progression.totalExp.inputValue()).toBe("50");
    await this.progression.changeCurrentExp("39");
    await this.progression.reload();
    await this.progression.open(this.progressionName);
    expect(await this.progression.currentExp.inputValue()).toBe("39");
  },
);
