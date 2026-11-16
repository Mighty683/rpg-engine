import { After, Before, setDefaultTimeout, setWorldConstructor, World } from "@cucumber/cucumber";
import { chromium, type Browser, type Page } from "playwright";
import { GamesPage } from "../pages/games-page.ts";
import { GamePage } from "../pages/game-page.ts";
import { PlayerPage } from "../pages/player-page.ts";
import { CharacterPage } from "../pages/character-page.ts";
import type { StoredClass } from "../../../backend/src/modules/class-catalog/types.ts";
import type { SeededGame } from "./seed.ts";
import type { CharacterProgressionPage } from "../pages/character-progression-page.ts";
import type { ClassCatalogPage } from "../pages/class-catalog-page.ts";

export class BrowserWorld extends World {
  browser?: Browser;
  page!: Page;
  games!: GamesPage;
  game!: GamePage;
  player!: PlayerPage;
  character!: CharacterPage;
  classCatalog!: ClassCatalogPage;
  classGameId!: string;
  progression!: CharacterProgressionPage;
  progressionGame!: SeededGame;
  progressionClass!: StoredClass;
  progressionName!: string;
  livePlayerPage!: Page;
  liveProgression!: CharacterProgressionPage;
  fallbackClass!: StoredClass;
}

setWorldConstructor(BrowserWorld);
setDefaultTimeout(15_000);

Before(async function (this: BrowserWorld) {
  this.browser = await chromium.launch({ headless: true });
  this.page = await this.browser.newPage();
  this.page.setDefaultTimeout(8_000);
  this.games = new GamesPage(this.page);
  this.game = new GamePage(this.page);
  this.player = new PlayerPage(this.page);
  this.character = new CharacterPage(this.page);
});

After(async function (this: BrowserWorld) {
  await this.browser?.close();
});
