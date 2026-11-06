import type { Locator, Page } from "playwright";

export class CharacterPage {
  readonly name: Locator;
  readonly theme: Locator;
  readonly hp: Locator;
  readonly playerLink: Locator;

  constructor(private readonly page: Page) {
    this.name = page.getByTestId("character-name");
    this.theme = page.getByTestId("character-theme");
    this.hp = page.getByTestId("character-hp");
    this.playerLink = page.getByTestId("player-link");
  }

  async editTheme(value: string) {
    await this.theme.fill(value);
    await this.theme.press("Tab");
  }

  async editHp(value: number) {
    await this.hp.fill(String(value));
    await this.hp.press("Tab");
  }
}
