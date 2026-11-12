import type { Page } from "playwright";

export class NpcsPage {
  constructor(private readonly page: Page) {}
  async create(name: string) {
    await this.page.getByTestId("edge-tab-npcs").click();
    await this.page.getByTestId("create-npc").click();
    const field = this.page.getByTestId("npc-name");
    await field.waitFor({ state: "visible" });
    const response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await field.fill(name);
    const saved = await response;
    if (!saved.ok()) throw new Error(`NPC update failed: ${saved.status()}`);
  }
  async addAttack(name: string) {
    let response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("add-attack").click();
    if (!(await response).ok()) throw new Error("NPC attack creation failed");
    response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("attack-name-0").fill(name);
    if (!(await response).ok()) throw new Error("NPC attack update failed");
  }
  async setLevelAndNotes(npc: string, level: number, notes: string) {
    if ((await this.page.getByTestId("npc-name").inputValue()) !== npc)
      throw new Error("The expected NPC editor is not open");
    const levelResponse = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("npc-level").fill(String(level));
    await this.page.getByTestId("npc-level").blur();
    if (!(await levelResponse).ok()) throw new Error("NPC level update failed");
    const notesResponse = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("npc-notes-field").fill(notes);
    if (!(await notesResponse).ok()) throw new Error("NPC notes update failed");
  }
  async setStats(npc: string) {
    if ((await this.page.getByTestId("npc-name").inputValue()) !== npc)
      throw new Error("The expected NPC editor is not open");
    const change = async (action: () => Promise<void>) => {
      const response = this.page.waitForResponse(
        (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
      );
      await action();
      if (!(await response).ok()) throw new Error("NPC stat update failed");
    };
    await change(async () => {
      await this.page.getByTestId("attribute-die-DEX").click();
      await this.page.getByTestId("attribute-die-option-12").click();
    });
    for (const attribute of ["INS", "MIG", "WLP"]) {
      await change(async () => {
        await this.page.getByTestId(`attribute-die-${attribute}`).click();
        await this.page.getByTestId("attribute-die-option-10").click();
      });
    }
    for (const [resource, maximum] of [
      ["HP", "60"],
      ["MP", "50"],
    ]) {
      await this.page.getByTestId(`maximum-button-${resource}`).click();
      await change(() => this.page.getByTestId(`maximum-input-${resource}`).fill(maximum!));
      await this.page.getByTestId(`maximum-button-${resource}`).click();
    }
    await change(() => this.page.getByTestId("character-hp").fill("40"));
    await change(() => this.page.getByTestId("character-mp").fill("30"));
    await change(() => this.page.getByTestId("defense-DEF").fill("9"));
    await change(() => this.page.getByTestId("defense-MAG DEF").fill("10"));
  }
  async savedStats(npc: string) {
    await this.card(npc).getByTestId("edit-npc").click();
    const values = {
      dex: await this.page.getByTestId("attribute-die-DEX").innerText(),
      ins: await this.page.getByTestId("attribute-die-INS").innerText(),
      mig: await this.page.getByTestId("attribute-die-MIG").innerText(),
      wlp: await this.page.getByTestId("attribute-die-WLP").innerText(),
      maxHp: await this.page.getByTestId("maximum-button-HP").innerText(),
      maxMp: await this.page.getByTestId("maximum-button-MP").innerText(),
      hp: await this.page.getByTestId("character-hp").inputValue(),
      mp: await this.page.getByTestId("character-mp").inputValue(),
      defense: await this.page.getByTestId("defense-DEF").inputValue(),
      magicDefense: await this.page.getByTestId("defense-MAG DEF").inputValue(),
    };
    await this.closeEditor();
    return values;
  }
  async closeEditor() {
    const close = this.page.getByTestId("close-npc-editor");
    if (await close.isVisible()) await close.click();
    await close.waitFor({ state: "hidden" });
  }
  async attackVisible(name: string) {
    await this.closeEditor();
    const toggle = this.page.getByTestId("toggle-attacks").first();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    return this.page.locator('[data-testid^="npc-card-"]').filter({ hasText: name }).count();
  }
  async failNameChange(name: string) {
    await this.page.route("**/api/games/*/npcs/*", async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({ status: 409, json: { error: { code: "stale_revision" } } });
      else await route.continue();
    });
    await this.page.getByTestId("npc-name").fill(name);
  }
  async editNameWithKeyboard(name: string) {
    const field = this.page.getByTestId("npc-name");
    await this.page.keyboard.press("Tab");
    await field.focus();
    const focusVisible = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.matches(":focus-visible") &&
        (style.outlineStyle !== "none" || style.boxShadow !== "none")
      );
    });
    if (!focusVisible) throw new Error("NPC name has no visible keyboard focus indicator");
    if (!(await field.evaluate((element) => document.activeElement === element)))
      throw new Error("NPC name did not receive focus");
    const response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.type(name);
    if (!(await response).ok()) throw new Error("NPC keyboard update failed");
  }
  async inspectPendingUpdate() {
    let release!: () => void;
    let received!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      received = resolve;
    });
    await this.page.route("**/api/games/*/npcs/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      received();
      await gate;
      await route.continue();
    });
    try {
      await this.page.getByTestId("npc-notes-field").fill("Pending update");
      await started;
      await this.page.getByTestId("npc-saving").waitFor({ state: "visible" });
      if (!(await this.page.getByTestId("npc-name").isDisabled()))
        throw new Error("NPC fields stayed enabled while saving");
    } finally {
      release();
    }
    await this.page.getByTestId("npc-saving").waitFor({ state: "hidden" });
    await this.page.unroute("**/api/games/*/npcs/*");
  }
  async changeAttack(npcName: string, oldName: string, attackName: string) {
    await this.card(npcName).getByTestId("edit-npc").click();
    if ((await this.page.getByTestId("attack-name-0").inputValue()) !== oldName)
      throw new Error("The expected attack is not open");
    const response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("attack-name-0").fill(attackName);
    if (!(await response).ok()) throw new Error("NPC attack update failed");
    await this.closeEditor();
  }
  async removeAttack(npcName: string, attackName: string) {
    await this.card(npcName).getByTestId("edit-npc").click();
    if ((await this.page.getByTestId("attack-name-0").inputValue()) !== attackName)
      throw new Error("The expected attack is not open");
    const response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("remove-attack-0").click();
    if (!(await response).ok()) throw new Error("NPC attack removal failed");
    await this.closeEditor();
  }
  async rollAndRerollAttack(name: string) {
    await this.card(name).getByTestId("roll-weapon").first().click();
    await this.page.getByTestId("submit-roll").click();
    const history = this.page.getByTestId("throw-entry");
    await history.last().waitFor({ state: "visible" });
    await history.last().getByTestId("reroll-throw").click();
    await this.page.getByTestId("submit-roll").click();
  }
  async remove(name: string) {
    await this.card(name).getByTestId("edit-npc").click();
    await this.page.getByTestId("remove-npc").click();
    await this.page.getByTestId("confirm-remove-npc").click();
  }
  async visibility(value: string) {
    if (!(await this.page.getByTestId("npc-visibility").isVisible()))
      await this.card("Bandit").getByTestId("edit-npc").click();
    const response = this.page.waitForResponse(
      (res) => res.request().method() === "PUT" && res.url().includes("/npcs/"),
    );
    await this.page.getByTestId("npc-visibility").selectOption(value);
    const saved = await response;
    if (!saved.ok()) throw new Error(`NPC update failed: ${saved.status()}`);
  }
  async rollDex(name: string) {
    await this.closeEditor();
    await this.card(name).getByTestId("roll-attribute-DEX").click();
    await this.page.getByTestId("submit-roll").click();
  }
  card(name: string) {
    return this.page.locator('[data-testid^="npc-card-"]').filter({ hasText: name });
  }
}
