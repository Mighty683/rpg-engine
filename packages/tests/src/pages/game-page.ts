import type { Locator, Page } from "playwright";

export class GamePage {
  readonly playerName: Locator;
  readonly addPlayerButton: Locator;

  constructor(private readonly page: Page) {
    this.playerName = page.getByTestId("player-name");
    this.addPlayerButton = page.getByTestId("add-player");
  }

  player(name: string) {
    return this.page.getByTestId("player-tab").filter({ hasText: name });
  }

  async openPlayer(name: string) {
    await this.player(name).click();
    await this.page.getByTestId("player-row-link").click();
  }

  async activeCharacter(name: string) {
    await this.player(name).click();
    return this.page.getByTestId("player-active-character");
  }

  async addPlayer(name: string) {
    await this.playerName.fill(name);
    const responsePromise = this.page
      .waitForResponse(
        (candidate) =>
          candidate.url().includes("/api/games/") &&
          candidate.url().endsWith("/players") &&
          candidate.request().method() === "POST",
        { timeout: 5000 },
      )
      .catch(() => undefined);
    await this.addPlayerButton.click();
    const response = await responsePromise;
    if (response && !response.ok())
      throw new Error(`Create player failed: ${response.status()} ${await response.text()}`);
  }
}
