import type { Locator, Page } from "playwright";

export class GamesPage {
  readonly emptyState: Locator;
  readonly createButton: Locator;
  readonly nameInput: Locator;
  readonly systemSelect: Locator;
  readonly submitButton: Locator;
  readonly createdToast: Locator;

  constructor(private readonly page: Page) {
    this.emptyState = page.getByTestId("games-empty");
    this.createButton = page.getByTestId("open-game-creation");
    this.nameInput = page.getByTestId("game-name");
    this.systemSelect = page.getByTestId("game-system");
    this.submitButton = page.getByTestId("submit-game");
    this.createdToast = page.getByTestId("game-created-toast");
  }

  gameRow(name: string) {
    return this.page
      .getByTestId("game-row")
      .filter({ has: this.page.getByTestId("game-row-name").filter({ hasText: name }) });
  }

  gameSystem(name: string) {
    return this.gameRow(name).getByTestId("game-row-system");
  }

  systemOption(systemId: string) {
    return this.page.getByTestId(`game-system-option-${systemId}`);
  }

  async createGame(name: string, systemId: string) {
    await this.createButton.click();
    await this.nameInput.fill(name);
    await this.systemSelect.click();
    await this.systemOption(systemId).click();
    await this.submitButton.click();
  }
}
