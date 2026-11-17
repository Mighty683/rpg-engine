import type { Page } from "playwright";
import { CharacterPage } from "./character-page.ts";
import { GameTablePage } from "./game-table-page.ts";

export class AgentEditPage {
  constructor(private readonly page: Page) {}
  get diff() {
    return this.page.getByTestId("agent-edit-diff");
  }
  get notice() {
    return this.page.getByTestId("agent-edit-notice");
  }
  async review() {
    await this.diff.waitFor();
  }
  async cancel() {
    await this.page.getByTestId("agent-cancel-edit").click();
  }
  async accept(method: "PUT" | "PATCH") {
    const result = this.page.waitForResponse((r) => r.request().method() === method);
    await this.page.getByTestId("agent-accept-edit").click();
    return (await result).status();
  }
  async changeHp(hp: number) {
    const result = this.page.waitForResponse((r) => r.request().method() === "PATCH");
    await new CharacterPage(this.page).editHp(hp);
    return (await result).status();
  }
  async openCharacter(name: string) {
    await new GameTablePage(this.page).partyCard(name).getByTestId("edit-character").click();
  }
  async npcProfile(id: string) {
    await this.page
      .getByTestId("npc-card-" + id)
      .getByTestId("edit-npc")
      .click();
    return {
      notes: await this.page.getByTestId("npc-notes-field").inputValue(),
      attack: await this.page.getByTestId("attack-name-0").inputValue(),
      hidden: await this.page.getByTestId("npc-visibility-hidden").isChecked(),
    };
  }
}
