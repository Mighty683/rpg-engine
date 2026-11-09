import { createGameAccessService } from "../../../backend/src/modules/games/service.ts";
import { createGameEvents } from "../../../backend/src/modules/events/streams.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { Given, Then, When } from "@cucumber/cucumber";
import { expect, inject } from "vite-plus/test";
import type { BrowserContext, Page } from "playwright";
import { randomUUID } from "node:crypto";
import type { BrowserWorld } from "../support/world.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { seedGame, seedPool, setPlayerActiveCharacter, type SeededGame } from "../support/seed.ts";
import { createThrow } from "../../../backend/src/modules/throws/service.ts";

const frontendUrl = () => inject("frontendUrl") as string;

function world(this: BrowserWorld) {
  return this as BrowserWorld & {
    seed?: SeededGame;
    playerContext?: BrowserContext;
    playerPage?: Page;
    playerTable?: GameTablePage;
  };
}

async function postThrow(game: SeededGame, setup: Record<string, unknown>) {
  const pool = await seedPool();
  try {
    const actor = { accountId: game.gm.accountId, sessionId: randomUUID() };
    const result = await createThrow(
      {
        gameAccessFor: createGameAccessService,
        events: createGameEvents(),
        database: databaseFromPool(pool),
      },
      actor,
      game.gameId,
      { sourceThrowId: null, setup } as never,
    );
    return result.record;
  } finally {
    await pool.end();
  }
}

async function seedManyThrows(game: SeededGame, count: number) {
  for (let index = 0; index < count; index++)
    await postThrow(game, {
      type: "free",
      characterId: "gm",
      dice: [8],
      modifier: index,
      redDice: [],
      redModifier: 0,
      note: `seed ${index + 1}`,
    });
}

Given(
  "a Fabula Ultima game with active GM and player characters and an inactive character",
  async function (this: BrowserWorld) {
    world.call(this).seed = await seedGame({ playerCharacters: 2, gmWeapon: "none" });
  },
);

Given("an active character with a configured weapon", async function (this: BrowserWorld) {
  world.call(this).seed = await seedGame({ gmWeapon: "complete" });
});

Given(
  "a GM and a player with active characters in the same game",
  async function (this: BrowserWorld) {
    world.call(this).seed = await seedGame({});
  },
);

Given(
  "the GM and a player have the same Game Table open in separate sessions",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    w.seed = await seedGame({});
    const table = new GameTablePage(this.page);
    await table.signIn(frontendUrl(), w.seed.gm.username, w.seed.gm.password);
    await table.openGame(frontendUrl(), w.seed.gameId);
    w.playerContext = await this.browser!.newContext();
    w.playerPage = await w.playerContext.newPage();
    w.playerTable = new GameTablePage(w.playerPage);
    await w.playerTable.signIn(frontendUrl(), w.seed.player.username, w.seed.player.password);
    await w.playerTable.openGame(frontendUrl(), w.seed.gameId);
  },
);

Given(
  "a player controls two characters and has no active character",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    w.seed = await seedGame({ playerCharacters: 2 });
    await setPlayerActiveCharacter(w.seed, null);
  },
);

Given(
  "an active character has a weapon with incomplete accuracy settings",
  async function (this: BrowserWorld) {
    world.call(this).seed = await seedGame({ gmWeapon: "incomplete" });
  },
);

Given(
  "a game has more throws than fit in the first history page",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    w.seed = await seedGame({});
    await seedManyThrows(w.seed, 25);
  },
);

Given(
  "history contains an opposed check with a modifier on each side and a note",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    w.seed = await seedGame({});
    await postThrow(w.seed, {
      type: "free",
      characterId: "gm",
      dice: [8, 10],
      modifier: 2,
      redDice: [6, 12],
      redModifier: 1,
      note: "clash",
    });
  },
);

async function ensureGmTable(w: ReturnType<typeof world> & BrowserWorld) {
  const table = new GameTablePage(w.page);
  const already = await table.table.count();
  if (already) return;
  await table.signIn(frontendUrl(), w.seed!.gm.username, w.seed!.gm.password);
  await table.openGame(frontendUrl(), w.seed!.gameId);
}

When("the GM opens the Game Table", async function (this: BrowserWorld) {
  const w = world.call(this);
  await ensureGmTable(w);
});

Then(
  "the party shows the active characters and their compact sheet data",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const table = new GameTablePage(this.page);
    const pool = await seedPool();
    const names = (
      await pool.query("SELECT name FROM characters WHERE game_id=$1 ORDER BY created_at", [
        w.seed!.gameId,
      ])
    ).rows.map((row) => row.name);
    await pool.end();
    const cards = table.partyList.getByTestId("party-card");
    await expect.poll(() => cards.count()).toBe(2);
    for (const name of names.slice(0, 2))
      await expect.poll(() => table.partyCard(name).isVisible()).toBe(true);
    await expect
      .poll(() => table.partyCard(names[0]!).getByTestId("party-hp").textContent())
      .toMatch(/\d+\s*\/\s*\d+/);
  },
);

When("the GM opens Character sheets and switches tabs", async function (this: BrowserWorld) {
  const w = world.call(this);
  const pool = await seedPool();
  const names = (
    await pool.query("SELECT name FROM characters WHERE game_id=$1 ORDER BY created_at", [
      w.seed!.gameId,
    ])
  ).rows.map((row) => row.name);
  await pool.end();
  await this.page.getByTestId("open-character-sheets").click();
  await this.page.getByTestId("character-controller").waitFor({ state: "visible" });
  await this.page.getByTestId("sheet-tab").filter({ hasText: names[1]! }).click();
});

Then("the selected sheet and controller are visible", async function (this: BrowserWorld) {
  await expect
    .poll(() => this.page.getByTestId("character-controller").textContent())
    .toContain("Controlled by");
  expect(await this.page.getByTestId("character-controller").isVisible()).toBe(true);
});

When("the GM closes the drawer, visits Settings and returns", async function (this: BrowserWorld) {
  await this.page.getByTestId("close-character-sheets").click();
  await this.page.getByTestId("open-settings").click();
  await expect.poll(() => this.page.getByTestId("game-heading").textContent()).toBe("Settings");
  await this.page.getByTestId("return-to-game").click();
});

Then("the Game Table is visible again", async function (this: BrowserWorld) {
  await expect.poll(() => this.page.getByTestId("game-table").isVisible()).toBe(true);
});

When(
  "the GM submits an attribute roll with a temporary die size, modifier and note",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    await ensureGmTable(w);
    const pool = await seedPool();
    const gmName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
    ).rows[0]!.name;
    await pool.end();
    const card = new GameTablePage(this.page).partyCard(gmName);
    await card.getByTestId("roll-attribute-DEX").click();
    await this.page.getByTestId("die-size-DEX-12").evaluate((el) => {
      (el as HTMLInputElement).click();
    });
    await this.page.getByTestId("check-modifier").fill("2");
    await this.page.getByTestId("roll-note").fill("temporary boost");
    await this.page.getByTestId("submit-roll").click();
    await this.page.getByTestId("throw-entry").first().waitFor({ state: "visible" });
  },
);

Then(
  "history shows the submitted setup and the sheet retains its saved die size",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const entry = new GameTablePage(this.page).lastThrow();
    await expect.poll(() => entry.getByTestId("throw-note").textContent()).toBe("temporary boost");
    await expect.poll(() => entry.getByTestId("throw-modifier").textContent()).toBe("+ 2");
    const pool = await seedPool();
    const gmName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
    ).rows[0]!.name;
    await pool.end();
    await expect
      .poll(() =>
        new GameTablePage(this.page)
          .partyCard(gmName)
          .getByTestId("roll-attribute-DEX")
          .textContent(),
      )
      .toContain("d8");
  },
);

When("the GM submits the weapon's accuracy roll", async function (this: BrowserWorld) {
  const w = world.call(this);
  const pool = await seedPool();
  const gmName = (
    await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
  ).rows[0]!.name;
  await pool.end();
  await new GameTablePage(this.page).partyCard(gmName).getByTestId("roll-weapon").click();
  await this.page.getByTestId("roll-dialog").waitFor({ state: "visible" });
  await this.page.getByTestId("submit-roll").click();
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(2);
});

Then("history shows the weapon and its accuracy result", async function (this: BrowserWorld) {
  const entry = new GameTablePage(this.page).lastThrow();
  await expect.poll(() => entry.getByTestId("throw-title").textContent()).toContain("Rapier");
  await expect.poll(() => entry.getByTestId("throw-result").textContent()).toContain("Accuracy");
});

When("the GM opens Reroll and cancels", async function (this: BrowserWorld) {
  await new GameTablePage(this.page).throwEntries().first().getByTestId("reroll-throw").click();
  await this.page.getByTestId("roll-dialog").waitFor({ state: "visible" });
  await this.page.getByTestId("cancel-roll").click();
});

Then("history is unchanged", async function (this: BrowserWorld) {
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(2);
});

When("the GM opens Reroll again, edits the note and confirms", async function (this: BrowserWorld) {
  await new GameTablePage(this.page).throwEntries().first().getByTestId("reroll-throw").click();
  await this.page.getByTestId("roll-note").fill("edited note");
  await this.page.getByTestId("submit-roll").click();
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(3);
});

Then(
  "history contains both the original roll and the new result",
  async function (this: BrowserWorld) {
    const entries = new GameTablePage(this.page).throwEntries();
    await expect
      .poll(() => entries.first().getByTestId("throw-note").textContent())
      .toBe("temporary boost");
    await expect
      .poll(() => entries.last().getByTestId("throw-note").textContent())
      .toBe("edited note");
  },
);

When("the GM opens Make a roll", async function (this: BrowserWorld) {
  const w = world.call(this);
  await ensureGmTable(w);
  await new GameTablePage(this.page).makeRoll.click();
  await this.page.getByTestId("free-roll-dialog").waitFor({ state: "visible" });
});

Then(
  "the pool is empty and Roll as offers GM and all active characters",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    await expect.poll(() => this.page.getByTestId("pool-empty").isVisible()).toBe(true);
    await this.page.getByTestId("roll-as").click();
    await expect.poll(() => this.page.getByTestId("roll-as-option-gm").isVisible()).toBe(true);
    const pool = await seedPool();
    const names = (
      await pool.query("SELECT name FROM characters WHERE game_id=$1 ORDER BY created_at", [
        w.seed!.gameId,
      ])
    ).rows.map((row) => row.name);
    await pool.end();
    for (const name of names)
      await expect
        .poll(() =>
          this.page.getByTestId("roll-as-option-character").filter({ hasText: name }).isVisible(),
        )
        .toBe(true);
    await this.page.keyboard.press("Escape");
  },
);

When(
  "the GM submits an opposed free roll as the player's character",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const pool = await seedPool();
    const playerName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.playerCharacterId])
    ).rows[0]!.name;
    await pool.end();
    await this.page.getByTestId("roll-as").click();
    await this.page.getByTestId("roll-as-option-character").filter({ hasText: playerName }).click();
    await this.page.getByTestId("add-die-d8").click();
    await this.page.getByTestId("add-die-d10").click();
    await this.page.getByTestId("opponent-add-d6").click();
    await this.page.getByTestId("opponent-add-d12").click();
    await this.page.getByTestId("free-modifier").fill("1");
    await this.page.getByTestId("opponent-modifier").fill("0");
    await this.page.getByTestId("submit-free-roll").click();
    await this.page.getByTestId("throw-entry").first().waitFor({ state: "visible" });
  },
);

Then(
  "history shows both sides, their totals, the outcome and GM attribution",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const pool = await seedPool();
    const playerName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.playerCharacterId])
    ).rows[0]!.name;
    await pool.end();
    const entry = new GameTablePage(this.page).lastThrow();
    await expect.poll(() => entry.getByTestId("throw-title").textContent()).toContain(playerName);
    await expect.poll(() => entry.getByTestId("throw-title").textContent()).toContain("GM");
    await expect.poll(() => entry.getByTestId("throw-outcome").textContent()).toMatch(/wins|Tie/);
    expect(await entry.getByTestId("throw-modifier").isVisible()).toBe(true);
    expect(await entry.getByTestId("throw-opponent-modifier").count()).toBe(0);
  },
);

When("the player makes a free roll", async function (this: BrowserWorld) {
  const w = world.call(this);
  if (!w.playerTable) {
    w.playerContext = await this.browser!.newContext();
    w.playerPage = await w.playerContext.newPage();
    w.playerTable = new GameTablePage(w.playerPage);
    await w.playerTable.signIn(frontendUrl(), w.seed!.player.username, w.seed!.player.password);
    await w.playerTable.openGame(frontendUrl(), w.seed!.gameId);
  }
  await w.playerTable.makeRoll.click();
  await w.playerPage!.getByTestId("add-die-d6").click();
  await w.playerPage!.getByTestId("submit-free-roll").click();
  await w.playerPage!.getByTestId("throw-entry").first().waitFor({ state: "visible" });
});

Then(
  "the roll is attributed to the player's active character",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const pool = await seedPool();
    const playerName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.playerCharacterId])
    ).rows[0]!.name;
    await pool.end();
    const entry = w.playerTable!.lastThrow();
    await expect.poll(() => entry.getByTestId("throw-title").textContent()).toContain(playerName);
  },
);

When("the player submits a roll", async function (this: BrowserWorld) {
  const w = world.call(this);
  await w.playerTable!.makeRoll.click();
  await w.playerPage!.getByTestId("add-die-d8").click();
  await w.playerPage!.getByTestId("submit-free-roll").click();
  await w.playerPage!.getByTestId("throw-entry").first().waitFor({ state: "visible" });
});

Then("the GM sees it appended without reloading", async function (this: BrowserWorld) {
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(1);
});

Then("the roll remains visible after the GM reloads", async function (this: BrowserWorld) {
  await this.page.reload();
  await this.page.getByTestId("throw-history").waitFor({ state: "visible" });
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(1);
});

When("the GM removes the roll", async function (this: BrowserWorld) {
  await new GameTablePage(this.page).throwEntries().first().getByTestId("remove-throw").click();
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(0);
});

Then("it disappears from the player's history", async function (this: BrowserWorld) {
  await expect.poll(() => world.call(this).playerTable!.throwEntries().count()).toBe(0);
});

Then("it stays absent after a reload", async function (this: BrowserWorld) {
  await world.call(this).playerPage!.reload();
  await world.call(this).playerPage!.getByTestId("game-table").waitFor({ state: "visible" });
  await expect.poll(() => world.call(this).playerTable!.throwEntries().count()).toBe(0);
});

When("the player tries to make a roll", async function (this: BrowserWorld) {
  const w = world.call(this);
  const table = new GameTablePage(this.page);
  await table.signIn(frontendUrl(), w.seed!.player.username, w.seed!.player.password);
  await table.openGame(frontendUrl(), w.seed!.gameId);
  await table.makeRoll.click();
  await this.page.getByTestId("free-roll-dialog").waitFor({ state: "visible" });
});

Then("the table directs them to select an active character", async function (this: BrowserWorld) {
  await expect
    .poll(() => this.page.getByTestId("player-roll-as").textContent())
    .toContain("Select an active character");
  expect(await this.page.getByTestId("submit-free-roll").isDisabled()).toBe(true);
  await this.page.getByTestId("cancel-free-roll").click();
});

When(
  "the player selects their first character and makes a free roll",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const names = w.seed!.playerCharacterIds;
    const pool = await seedPool();
    const firstName = (await pool.query("SELECT name FROM characters WHERE id=$1", [names[0]]))
      .rows[0]!.name;
    await pool.end();
    await this.page.getByTestId("manage-characters").click();
    await new GameTablePage(this.page).selectCharacter(firstName);
    await this.page.getByTestId("return-to-game").click();
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
    await this.page.getByTestId("make-roll").click();
    await this.page.getByTestId("add-die-d8").click();
    await this.page.getByTestId("submit-free-roll").click();
    await this.page.getByTestId("throw-entry").first().waitFor({ state: "visible" });
  },
);

When(
  "the player switches to their second character and makes another free roll",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const pool = await seedPool();
    const secondName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.playerCharacterIds[1]])
    ).rows[0]!.name;
    await pool.end();
    await this.page.getByTestId("manage-characters").click();
    await new GameTablePage(this.page).selectCharacter(secondName);
    await this.page.getByTestId("return-to-game").click();
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
    await this.page.getByTestId("make-roll").click();
    await this.page.getByTestId("add-die-d10").click();
    await this.page.getByTestId("submit-free-roll").click();
    await expect.poll(() => this.page.getByTestId("throw-entry").count()).toBe(2);
  },
);

Then("the party shows the second character as active", async function (this: BrowserWorld) {
  const w = world.call(this);
  const pool = await seedPool();
  const [firstName, secondName] = (
    await pool.query("SELECT name FROM characters WHERE id=ANY($1::uuid[]) ORDER BY created_at", [
      w.seed!.playerCharacterIds,
    ])
  ).rows.map((row) => row.name);
  await pool.end();
  const table = new GameTablePage(this.page);
  await expect.poll(() => table.partyCard(secondName).isVisible()).toBe(true);
  expect(await table.partyCard(firstName).count()).toBe(0);
});

Then(
  "history attributes each roll to the character active when it was made",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    const pool = await seedPool();
    const [firstName, secondName] = (
      await pool.query("SELECT name FROM characters WHERE id=ANY($1::uuid[]) ORDER BY created_at", [
        w.seed!.playerCharacterIds,
      ])
    ).rows.map((row) => row.name);
    await pool.end();
    const entries = new GameTablePage(this.page).throwEntries();
    await expect
      .poll(() => entries.first().getByTestId("throw-title").textContent())
      .toContain(firstName);
    await expect
      .poll(() => entries.last().getByTestId("throw-title").textContent())
      .toContain(secondName);
  },
);

When(
  "the GM tries to roll with that weapon from the party card",
  async function (this: BrowserWorld) {
    const w = world.call(this);
    await ensureGmTable(w);
    const pool = await seedPool();
    const gmName = (
      await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
    ).rows[0]!.name;
    await pool.end();
    await new GameTablePage(this.page).partyCard(gmName).getByTestId("roll-weapon").click();
  },
);

Then("the card directs the GM to the character sheet", async function (this: BrowserWorld) {
  await expect
    .poll(() => this.page.getByTestId("weapon-setup-hint").textContent())
    .toContain("character sheet");
});

When(
  "the GM saves the weapon's accuracy settings and returns to the table",
  async function (this: BrowserWorld) {
    await this.page.getByTestId("open-sheet-for-weapon").click();
    await this.page.getByTestId("character-controller").waitFor({ state: "visible" });
    await new GameTablePage(this.page).configureWeapon();
    await expect
      .poll(() => this.page.getByTestId("save-status").textContent())
      .toContain("Saved automatically");
    await this.page.getByTestId("close-character-sheets").click();
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
  },
);

Then("the weapon card shows the configured attributes", async function (this: BrowserWorld) {
  const w = world.call(this);
  const pool = await seedPool();
  const gmName = (
    await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
  ).rows[0]!.name;
  await pool.end();
  const weapon = new GameTablePage(this.page).partyCard(gmName).getByTestId("roll-weapon");
  await expect.poll(() => weapon.textContent()).toContain("DEX");
  await expect.poll(() => weapon.textContent()).toContain("INS");
});

When("the GM rolls with the weapon", async function (this: BrowserWorld) {
  const w = world.call(this);
  const pool = await seedPool();
  const gmName = (
    await pool.query("SELECT name FROM characters WHERE id=$1", [w.seed!.gmCharacterId])
  ).rows[0]!.name;
  await pool.end();
  await new GameTablePage(this.page).partyCard(gmName).getByTestId("roll-weapon").click();
  await this.page.getByTestId("submit-roll").click();
  await this.page.getByTestId("throw-entry").first().waitFor({ state: "visible" });
});

Then("history shows its accuracy result", async function (this: BrowserWorld) {
  const entry = new GameTablePage(this.page).lastThrow();
  await expect.poll(() => entry.getByTestId("throw-title").textContent()).toContain("Rapier");
  await expect.poll(() => entry.getByTestId("throw-result").textContent()).toContain("Accuracy");
});

Then("history opens at the latest throw", async function (this: BrowserWorld) {
  const history = new GameTablePage(this.page).history;
  await history.waitFor({ state: "visible" });
  await expect
    .poll(() => history.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2))
    .toBe(true);
  await expect
    .poll(() =>
      new GameTablePage(this.page).throwEntries().last().getByTestId("throw-note").textContent(),
    )
    .toBe("seed 25");
});

When("the GM scrolls back and loads older throws", async function (this: BrowserWorld) {
  const table = new GameTablePage(this.page);
  const history = table.history;
  const pinned = table.throwEntries().filter({ hasText: "seed 6" });
  await history.evaluate((el) => {
    el.scrollTop = 0;
  });
  const before = await pinned.boundingBox();
  await table.page.getByTestId("load-older-throws").click();
  await expect.poll(() => table.throwEntries().count()).toBe(25);
  await expect.poll(() => pinned.boundingBox()).toEqual(before);
});

Then(
  "the older throws appear in order and the visible entry keeps its position",
  async function (this: BrowserWorld) {
    const table = new GameTablePage(this.page);
    await expect
      .poll(() => table.throwEntries().first().getByTestId("throw-note").textContent())
      .toBe("seed 1");
  },
);

When("the GM makes a new free roll", async function (this: BrowserWorld) {
  await new GameTablePage(this.page).makeRoll.click();
  await this.page.getByTestId("add-die-d6").click();
  await this.page.getByTestId("submit-free-roll").click();
  await expect
    .poll(() =>
      new GameTablePage(this.page).throwEntries().last().getByTestId("throw-result").textContent(),
    )
    .toContain("Total");
});

Then("history scrolls to the new result at the bottom", async function (this: BrowserWorld) {
  const table = new GameTablePage(this.page);
  const history = table.history;
  await expect
    .poll(() => history.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2))
    .toBe(true);
  await expect
    .poll(() => table.throwEntries().last().getByTestId("throw-result").textContent())
    .toContain("Total");
});

When("the GM opens Reroll for that check", async function (this: BrowserWorld) {
  const w = world.call(this);
  await ensureGmTable(w);
  const pool = await seedPool();
  const throwId = (
    await pool.query("SELECT id FROM throws WHERE game_id=$1 ORDER BY seq", [w.seed!.gameId])
  ).rows[0]!.id as string;
  await pool.end();
  await new GameTablePage(this.page).throwEntry(throwId).getByTestId("reroll-throw").click();
  await this.page.getByTestId("free-roll-dialog").waitFor({ state: "visible" });
});

Then(
  "the setup shows the saved friendly and opposing dice, both modifiers, and the note",
  async function (this: BrowserWorld) {
    await expect.poll(() => this.page.getByTestId("pool-die-d8").count()).toBe(1);
    await expect.poll(() => this.page.getByTestId("pool-die-d10").count()).toBe(1);
    await expect.poll(() => this.page.getByTestId("opponent-pool-d6").count()).toBe(1);
    await expect.poll(() => this.page.getByTestId("opponent-pool-d12").count()).toBe(1);
    await expect.poll(() => this.page.getByTestId("free-modifier").inputValue()).toBe("2");
    await expect.poll(() => this.page.getByTestId("opponent-modifier").inputValue()).toBe("1");
    await expect.poll(() => this.page.getByTestId("free-note").inputValue()).toBe("clash");
  },
);

When("the GM changes the opposing modifier and confirms", async function (this: BrowserWorld) {
  await this.page.getByTestId("opponent-modifier").fill("3");
  await this.page.getByTestId("submit-free-roll").click();
  await expect.poll(() => new GameTablePage(this.page).throwEntries().count()).toBe(2);
});

Then(
  "history shows both the original result and the new opposed result",
  async function (this: BrowserWorld) {
    const entries = new GameTablePage(this.page).throwEntries();
    await expect
      .poll(() => entries.first().getByTestId("throw-opponent-modifier").textContent())
      .toBe("+ 1");
    await expect
      .poll(() => entries.last().getByTestId("throw-opponent-modifier").textContent())
      .toBe("+ 3");
    await expect
      .poll(() => entries.last().getByTestId("throw-outcome").textContent())
      .toMatch(/wins|Tie/);
  },
);
