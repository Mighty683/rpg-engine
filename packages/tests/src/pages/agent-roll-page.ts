import type { Page } from "playwright";
export class AgentRollPage {
  constructor(readonly page: Page) {}
  get preview() {
    return this.page.getByTestId("agent-roll-preview");
  }
  get result() {
    return this.page.getByTestId("agent-roll-result").last();
  }
  get privacy() {
    return this.page.getByTestId("agent-roll-private");
  }
  async confirm() {
    const [request] = await Promise.all([
      this.page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/throws")),
      this.preview.getByTestId("agent-make-roll").click(),
    ]);
    await this.preview.waitFor({ state: "hidden" });
    await this.result.waitFor();
    return request.postDataJSON().sourceThrowId;
  }
  async shownOutcome() {
    const faces = (await this.result.getByTestId("agent-roll-face").allTextContents()).map(Number);
    const total = Number(await this.result.getByTestId("agent-roll-total").first().innerText());
    return { faces, total };
  }
}
