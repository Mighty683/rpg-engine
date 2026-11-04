import { After, Before, setWorldConstructor, World } from "@cucumber/cucumber";
import { chromium, type Browser, type Page } from "playwright";
import { GamesPage } from "../pages/games-page.ts";

export class BrowserWorld extends World {
  browser?: Browser;
  page!: Page;
  games!: GamesPage;
}

setWorldConstructor(BrowserWorld);

Before(async function (this: BrowserWorld) {
  this.browser = await chromium.launch({ headless: true });
  this.page = await this.browser.newPage();
  this.games = new GamesPage(this.page);
});

After(async function (this: BrowserWorld) {
  await this.browser?.close();
});
