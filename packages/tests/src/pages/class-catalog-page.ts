import type { Page } from "playwright";

export class ClassCatalogPage {
  constructor(private readonly page: Page) {}

  private button(prefix: string, name: string) {
    return this.page
      .getByTestId("class-catalog-entry")
      .filter({ hasText: name })
      .locator(`[data-testid^="${prefix}-"]`);
  }

  private async save(action: () => Promise<void>, method: "POST" | "PATCH") {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (result) =>
          result.request().method() === method &&
          /\/api\/(?:library\/class|games\/[\w-]+\/classes)/.test(result.url()),
      ),
      action(),
    ]);
    if (!response.ok())
      throw new Error(`Class save failed (${response.status()}): ${await response.text()}`);
  }

  async openLibrary() {
    await this.page.getByTestId("open-class-library").click();
  }
  async openGameCatalog() {
    await this.page.getByTestId("open-game-classes").click();
  }
  async switchCatalog() {
    await this.page.getByTestId("switch-class-context").click();
  }
  async backToList() {
    await this.page.getByTestId("back-to-classes").click();
  }
  async create(name: string) {
    await this.page.getByTestId("create-class").click();
    await this.page.getByTestId("create-class-name").fill(name);
    await this.save(() => this.page.getByTestId("add-library-class").click(), "POST");
  }
  async addFreeBenefit(name: string, effect: string) {
    await this.page.getByTestId("class-tab-benefits").click();
    await this.page.getByTestId("new-benefit-name").fill(name);
    await this.page.getByTestId("add-benefit").click();
    await this.save(() => this.benefitEffect.fill(effect), "PATCH");
  }
  async addSkill(name: string, rank: string) {
    await this.page.getByTestId("class-tab-skills").click();
    await this.page.getByTestId("add-skill").click();
    await this.save(() => this.skillName.fill(name), "PATCH");
    await this.save(() => this.skillRank.fill(rank), "PATCH");
  }
  async inspect(name: string) {
    await this.button("view-class", name).click();
  }
  async rename(name: string) {
    await this.save(() => this.name.fill(name), "PATCH");
  }
  async copy(name: string) {
    await this.page.getByTestId("copy-from-library").click();
    await this.save(() => this.button("copy-class", name).click(), "POST");
  }
  async saveNew(name: string, templateName: string) {
    await this.button("save-to-library", name).click();
    await this.page.getByTestId("library-save-name").fill(templateName);
    await this.save(() => this.confirmSave.click(), "POST");
    await this.confirmSave.waitFor({ state: "hidden" });
  }
  async replace(name: string, template: string) {
    await this.button("save-to-library", name).click();
    await this.page.getByTestId("library-save-mode").click();
    await this.page.getByTestId("library-save-update").click();
    await this.page.getByTestId("library-save-template").click();
    await this.page
      .locator('[data-testid^="library-template-"]')
      .filter({ hasText: template })
      .click();
    await this.save(() => this.confirmSave.click(), "POST");
    await this.confirmSave.waitFor({ state: "hidden" });
  }
  async readBenefit() {
    await this.page.getByTestId("class-tab-benefits").click();
    return this.benefitEffect.inputValue();
  }
  async readSkill() {
    await this.page.getByTestId("class-tab-skills").click();
    return { name: await this.skillName.inputValue(), rank: await this.skillRank.inputValue() };
  }

  async requestSkillRemoval(skillId: string) {
    await this.page.getByTestId("class-tab-skills").click();
    await this.page.getByTestId(`remove-skill-${skillId}`).click();
    await this.affectedUsers.waitFor();
    await this.page.waitForFunction(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
  }

  async cancelSkillRemoval() {
    await this.page.getByTestId("cancel-skill-removal").click();
    await this.affectedUsers.waitFor({ state: "hidden" });
  }

  async confirmSkillRemoval() {
    await this.save(() => this.page.getByTestId("confirm-skill-removal").click(), "PATCH");
    await this.affectedUsers.waitFor({ state: "hidden" });
  }

  async deleteClass(id: string) {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (result) =>
          result.request().method() === "DELETE" && result.url().endsWith(`/classes/${id}`),
      ),
      this.page.getByTestId(`remove-class-${id}`).click(),
    ]);
    if (response.status() !== 204) throw new Error(`Class deletion failed: ${response.status()}`);
  }

  skill(id: string) {
    return this.page.getByTestId(`skill-${id}`);
  }

  get affectedUsers() {
    return this.page.getByTestId("affected-skill-users");
  }

  get name() {
    return this.page.getByTestId("class-name");
  }
  get empty() {
    return this.page.getByTestId("empty-class-list");
  }
  get entries() {
    return this.page.getByTestId("class-catalog-entry");
  }
  private get benefitEffect() {
    return this.page.locator('[data-testid^="benefit-description-"]');
  }
  private get skillName() {
    return this.page.locator('[data-testid^="skill-name-"]');
  }
  private get skillRank() {
    return this.page.locator('[data-testid^="skill-rank-"]');
  }
  private get confirmSave() {
    return this.page.getByTestId("confirm-save-to-library");
  }
}
