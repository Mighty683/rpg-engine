import type { Locator, Page } from "playwright";

export class PlayerPage {
  readonly characterName: Locator;
  readonly createCharacterButton: Locator;

  constructor(private readonly page: Page) {
    this.characterName = page.getByTestId("character-name-input");
    this.createCharacterButton = page.getByTestId("create-character");
  }

  character(name: string) {
    return this.page.getByTestId("character-link").filter({ hasText: name });
  }

  async createCharacter(name: string) {
    await this.characterName.fill(name);
    await this.createCharacterButton.click();
  }
}
