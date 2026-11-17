import type { Page } from "playwright";

export class AgentPage {
  constructor(readonly page: Page) {}
  get launcher() {
    return this.page.getByTestId("agent-chat-launcher");
  }
  get draft() {
    return this.page.getByTestId("agent-command");
  }
  get send() {
    return this.page.getByTestId("agent-submit");
  }
  get transcript() {
    return this.page.getByTestId("agent-result");
  }
  async open() {
    await this.launcher.click();
    await this.draft.waitFor({ state: "visible" });
  }
  async close() {
    await this.page.getByTestId("agent-chat-close").click();
  }
  async ask(text: string) {
    await this.draft.fill(text);
    await this.send.waitFor({ state: "visible" });
    await this.send.click();
  }
  async scrollTop() {
    await this.transcript.evaluate((el) => {
      el.scrollTop = 0;
    });
  }
  async scrollBottom() {
    await this.transcript.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }
  async readingPosition() {
    return this.transcript.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const first = [...el.querySelectorAll<HTMLElement>("[data-message-id]")].find(
        (n) => n.getBoundingClientRect().bottom > top,
      );
      return {
        first: first?.dataset.messageId,
        offset: Math.round((first?.getBoundingClientRect().top ?? 0) - top),
      };
    });
  }
  async atBottom() {
    return this.transcript.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop <= 2);
  }
}
