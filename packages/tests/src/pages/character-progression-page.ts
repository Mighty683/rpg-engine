import type { Page, Route } from "playwright";
import { GameTablePage } from "./game-table-page.ts";

export class CharacterProgressionPage {
  private readonly table: GameTablePage;
  constructor(private readonly page: Page) {
    this.table = new GameTablePage(page);
  }

  async openDirect(url: string, gameId: string, id: string) {
    await this.page.goto(`${url}/games/${gameId}/characters/${id}`);
    await this.currentExp.waitFor();
    await this.addClass.waitFor();
  }
  async create(name: string) {
    await this.page.getByTestId("manage-characters").click();
    await this.page.getByTestId("create-character").click();
    await this.page.getByTestId("character-name").fill(name);
    await this.page.getByTestId("confirm-create-character").click();
    await this.table.partyCard(name).waitFor();
  }
  editAbility(name: string) {
    return this.table.partyCard(name).getByTestId("edit-character");
  }
  async open(name: string) {
    await this.editAbility(name).click();
    await this.currentExp.waitFor();
    await this.addClass.waitFor();
  }
  async close() {
    await this.page.getByTestId("close-character-sheets").click();
    await this.currentExp.waitFor({ state: "hidden" });
  }
  async switchTo(id: string) {
    await this.page
      .getByTestId("sheet-tab")
      .and(this.page.locator(`[data-character-id="${id}"]`))
      .click();
  }
  async chooseClass(id: string) {
    await this.addClass.click();
    await this.classOption(id).click();
  }
  classOption(id: string) {
    return this.page.getByTestId(`choose-class-${id}`);
  }
  async selectSkill(classId: string, skillId: string) {
    await this.expandClass(classId);
    await this.page.getByTestId(`add-skill-${classId}`).click();
    await this.page.getByTestId(`select-skill-${skillId}`).click();
  }
  async expandClass(id: string) {
    await this.page.getByTestId(`class-summary-${id}`).click();
  }
  classCard(id: string) {
    return this.page.getByTestId(`class-card-${id}`);
  }
  classLevel(id: string) {
    return this.page.getByTestId(`class-progress-${id}`).getByTestId("progress-meter");
  }
  skillRank(id: string) {
    return this.page.getByTestId(`skill-progress-${id}`).getByTestId("progress-meter");
  }
  async lowerSkill(id: string) {
    await this.page.getByTestId(`skill-progress-${id}`).getByTestId("decrease-progress").click();
  }
  async lowerClass(id: string) {
    await this.page.getByTestId(`class-progress-${id}`).getByTestId("decrease-progress").click();
  }
  async changeLevel(value: string) {
    await this.level.fill(value);
    await this.level.blur();
    await this.waitUntilSaved();
  }
  async changeCurrentExp(value: string) {
    await this.currentExp.fill(value);
    await this.currentExp.blur();
    await this.waitUntilSaved();
  }
  async waitUntilSaved() {
    await this.page.getByTestId("save-status").filter({ hasText: "Saved automatically" }).waitFor();
  }
  async reload() {
    await this.page.reload();
    await this.table.table.waitFor();
  }
  async loseNextSaveResponse() {
    let markCommitted!: (value: number) => void;
    let dropResponse!: () => void;
    const committed = new Promise<number>((resolve) => {
      markCommitted = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      dropResponse = resolve;
    });
    await this.page.route("**/api/games/*/characters/*", async (route: Route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      const response = await route.fetch();
      markCommitted(response.status());
      if (response.status() !== 200) return route.fulfill({ response });
      await pending;
      await route.abort("failed");
    });
    return { committed, dropResponse };
  }
  async inspectPartyClass(name: string) {
    await this.table.partyCard(name).locator('[data-testid^="table-classes-"]').click();
  }
  async dismissPartyClass() {
    await this.page.keyboard.press("Escape");
  }
  get saving() {
    return this.page.getByTestId("save-status").filter({ hasText: "Saving…" });
  }
  partyHp(name: string) {
    return this.table.partyCard(name).getByTestId("party-hp");
  }
  get reloadAction() {
    return this.page.getByTestId("reload-saved-sheet");
  }
  get currentExp() {
    return this.page.getByTestId("current-exp");
  }
  get totalExp() {
    return this.page.getByTestId("total-exp");
  }
  get addClass() {
    return this.page.getByTestId("add-class");
  }
  get level() {
    return this.page.getByTestId("character-level");
  }
  get maximumHp() {
    return this.page.getByTestId("maximum-button-HP");
  }
  get sheet() {
    return this.page.getByTestId("character-controller");
  }
}
