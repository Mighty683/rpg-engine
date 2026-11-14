import type { Locator, Page } from "playwright";

export class GameTablePage {
  readonly table: Locator;
  readonly partyList: Locator;
  readonly history: Locator;
  readonly makeRoll: Locator;

  constructor(readonly page: Page) {
    this.table = page.getByTestId("game-table");
    this.partyList = page.getByTestId("party-list");
    this.history = page.getByTestId("throw-history");
    this.makeRoll = page.getByTestId("make-roll");
  }

  async signIn(url: string, username: string, password: string) {
    await this.page.goto(url);
    await this.page.getByTestId("auth-username").fill(username);
    await this.page.getByTestId("auth-password").fill(password);
    const [response] = await Promise.all([
      this.page.waitForResponse((response) => response.url().endsWith("/api/auth/login")),
      this.page.getByTestId("auth-submit").click(),
    ]);
    if (!response.ok())
      throw new Error(`Sign-in failed with HTTP ${response.status()}: ${await response.text()}`);
    await this.page.getByTestId("open-game-creation").waitFor({ state: "visible" });
  }

  async openGame(url: string, gameId: string) {
    await this.page.goto(`${url}/games/${gameId}`);
    await this.table.waitFor({ state: "visible" });
  }

  async openHistory() {
    if (!(await this.makeRoll.isVisible())) await this.page.getByTestId("edge-tab-history").click();
    await this.makeRoll.waitFor({ state: "visible" });
  }

  async closeHistory() {
    if (await this.makeRoll.isVisible()) await this.page.keyboard.press("Escape");
    await this.makeRoll.waitFor({ state: "hidden" });
  }

  async selectCharacter(name: string) {
    await this.page
      .getByTestId("character-control-tile")
      .filter({ hasText: name })
      .getByTestId("set-active")
      .click();
  }

  async configureWeapon() {
    await this.page.getByTestId("open-entry-details").first().click();
    await this.page.getByTestId("weapon-attribute-2").click();
    await this.page.getByTestId("weapon-attribute-2-option-INS").click();
    await this.page.getByTestId("weapon-accuracy-bonus").fill("1");
  }

  partyCard(name: string) {
    return this.page.getByTestId("party-card").filter({ hasText: name });
  }

  throwEntries() {
    return this.page.getByTestId("throw-entry");
  }

  throwEntry(id: string) {
    return this.page.locator(`[data-testid="throw-entry"][data-throw-id="${id}"]`);
  }

  lastThrow() {
    return this.page.getByTestId("throw-entry").last();
  }

  async submitRoll() {
    await this.page.getByTestId("submit-roll").click();
  }

  async submitFreeRoll() {
    await this.page.getByTestId("submit-free-roll").click();
  }
}
