import type { Page } from "playwright";

export class GamePage {
  constructor(private readonly page: Page) {}

  character(name: string) {
    return this.page.getByTestId("character-control-tile").filter({ hasText: name });
  }

  async createCharacter(name: string) {
    await this.page.getByTestId("create-character").click();
    await this.page.getByTestId("character-name").fill(name);
    await this.page.getByRole("dialog").getByRole("button", { name: "Create character" }).click();
  }

  async returnToGame() {
    await this.page.getByTestId("return-to-game").click();
  }

  async openManagement() {
    await this.page.getByTestId("manage-characters").click();
  }

  async openCharacter(name: string) {
    await this.character(name).getByRole("button", { name: "Open sheet" }).click();
  }

  async toggleCharacter(name: string) {
    await this.character(name).getByTestId("set-active").click();
  }
}
