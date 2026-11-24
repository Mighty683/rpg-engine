import type { Locator, Page } from "playwright";

/**
 * Page object for the game-notes screens: table Drawer, notes search screen,
 * entry detail, new-entry form, formatting toolbar, player unavailable screen
 * and note toasts. Selectors are data-testid based; DOM shaping interactions
 * (rich-text toolbar, synthetic paste, formats assertions) live here.
 */
export class GameNotesPage {
  readonly createEntry: Locator;
  readonly cancelEntry: Locator;
  readonly createdToast: Locator;
  readonly errorToast: Locator;
  readonly createdTitle: Locator;
  readonly content: Locator;

  constructor(readonly page: Page) {
    this.createEntry = page.getByTestId("note-create");
    this.cancelEntry = page.getByTestId("note-cancel");
    this.createdToast = page.getByTestId("note-created-toast");
    this.errorToast = page.getByTestId("note-error-toast");
    this.createdTitle = page.getByTestId("notes-heading");
    this.content = page.getByTestId("note-content");
  }

  async openNotes(url: string, gameId: string) {
    await this.page.goto(`${url}/games/${gameId}/notes`);
    await this.page
      .locator('[data-testid="notes-screen"], [data-testid="notes-unavailable"]')
      .first()
      .waitFor({ state: "visible" });
  }

  async openNewEntry(url: string, gameId: string) {
    await this.page.goto(`${url}/games/${gameId}/notes/new`);
    await this.page
      .locator('[data-testid="note-create"], [data-testid="notes-unavailable"]')
      .first()
      .waitFor({ state: "visible" });
  }

  async openTable(url: string, gameId: string) {
    await this.page.goto(`${url}/games/${gameId}`);
    await this.page.getByTestId("game-table").waitFor({ state: "visible" });
  }

  async openTableDrawer() {
    await this.page.getByTestId("edge-tab-notes").click();
    await this.drawerPanel.waitFor({ state: "visible" });
  }

  async dismissTableDrawer() {
    await this.page.keyboard.press("Escape");
    await this.drawerPanel.waitFor({ state: "hidden" });
  }

  get drawerTab() {
    return this.page.getByTestId("edge-tab-notes");
  }

  get drawerPanel() {
    return this.page.getByTestId("notes-panel");
  }

  get drawerList() {
    return this.page.getByTestId("notes-drawer-list");
  }

  get searchAllEntries() {
    return this.page.getByTestId("notes-open-search");
  }

  get searchInput() {
    return this.page.getByTestId("notes-search");
  }

  get resultsList() {
    return this.page.getByTestId("notes-list");
  }

  get backToResults() {
    return this.page.getByTestId("breadcrumb-game-notes");
  }

  get noteTitle() {
    return this.page.getByTestId("note-title");
  }

  get backToGame() {
    return this.page.getByTestId("breadcrumb-game-table");
  }

  get unavailable() {
    return this.page.getByTestId("notes-unavailable");
  }

  get unavailableBack() {
    return this.page.getByTestId("breadcrumb-game-table");
  }

  get emptyNotebook() {
    return this.page.getByTestId("notes-empty");
  }

  get noMatch() {
    return this.page.getByTestId("notes-no-match");
  }

  resultCard(id: string) {
    return this.page.getByTestId(`open-note-${id}`);
  }

  drawerCard(id: string) {
    return this.page.getByTestId(`recent-note-${id}`);
  }

  cards(locator: "list" | "drawer") {
    return locator === "list"
      ? this.resultsList.getByTestId(/open-note-.+/)
      : this.drawerList.getByTestId(/recent-note-.+/);
  }

  cardTitle(card: Locator) {
    return card.locator(".note-open");
  }

  cardBody(card: Locator) {
    return card.locator(".note-body");
  }

  cardMetadata(card: Locator) {
    return card.getByTestId("note-metadata");
  }

  formatButton(name: string) {
    return this.page.getByTestId(`note-format-${name}`);
  }

  get headerSelect() {
    return this.page.getByTestId("note-format-header");
  }

  async retryToastAction(label = "Retry edits") {
    await this.page.getByRole("button", { name: label }).first().click();
  }

  async fillTitle(title: string) {
    await this.noteTitle.fill(title);
  }

  async focusBody() {
    await this.content.click();
  }

  async typeBody(text: string) {
    await this.focusBody();
    await this.page.keyboard.type(text);
  }

  /** Types one line inside the body with the given toolbar format toggled on and off. */
  async typeFormattedLine(format: string, text: string) {
    await this.formatButton(format).click();
    await this.page.keyboard.type(text);
    await this.formatButton(format).click();
  }

  async applyHeading(level: string) {
    await this.headerSelect.selectOption(level);
  }

  async clearSelectionFormatting() {
    await this.formatButton("clean").click();
  }

  async selectCurrentLine() {
    await this.page.keyboard.press("Home");
    await this.page.keyboard.press("Shift+End");
  }

  async gotoBodyEnd() {
    await this.page.keyboard.press("Control+End");
  }

  async gotoBodyStart() {
    await this.page.keyboard.press("Control+Home");
  }

  /** Dispatches a rich-text paste payload into the Quill editor. */
  async pasteHtml(html: string, plain: string) {
    await this.content.evaluate(
      (target, payload) => {
        const data = new DataTransfer();
        data.setData("text/html", payload.html);
        data.setData("text/plain", payload.plain);
        target.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { html, plain },
    );
  }

  /** Negotiated request interception that fails note saves during a scenario. */
  private readonly notePath = /\/api\/games\/[^/]+\/notes(\/[^/]+)?(\?.*)?$/;

  async blockNoteSaves() {
    await this.page.route(this.notePath, (route) => {
      if (["POST", "PATCH"].includes(route.request().method())) {
        void route.abort("connectionfailed");
        return;
      }
      void route.continue();
    });
  }

  async unblockNoteSaves() {
    await this.page.unroute(this.notePath);
  }
}
