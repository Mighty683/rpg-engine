import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createMemoryHistory, createRouter } from "vue-router";
import UApp from "@nuxt/ui/components/App.vue";
import ui from "@nuxt/ui/vue-plugin";
import { providePrototypeApiServices, resetPrototypeBackend } from "../api";
import { startPrototypeBackend } from "../mock-backend/browser";
import AgentTablePreview from "./AgentTablePreview.vue";
import "../../src/style.css";

test("Agent minimizes to the bottom bar and preserves the conversation and draft", async () => {
  await startPrototypeBackend();
  resetPrototypeBackend();
  const available = ref(true);
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({
    render: () =>
      h(UApp, null, { default: () => h(AgentTablePreview, { available: available.value }) }),
  });
  providePrototypeApiServices(app);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: AgentTablePreview }],
  });
  app.use(router).use(ui).use(VueQueryPlugin, { queryClient: new QueryClient() });
  app.mount(root);

  try {
    const agent = page.getByTestId("agent-chat-launcher");
    const history = page.getByTestId("edge-tab-history");
    const panel = page.getByTestId("prototype-agent-panel");
    const draft = page.getByTestId("prototype-agent-command");
    const run = page.getByTestId("prototype-agent-submit");
    const result = page.getByTestId("prototype-agent-result");

    await expect.element(page.getByTestId("party-list")).toBeVisible();
    await expect.element(agent).toBeVisible();
    const launcher = agent.element().getBoundingClientRect();
    expect(launcher.bottom).toBeLessThanOrEqual(globalThis.innerHeight);
    expect(globalThis.innerHeight - launcher.bottom).toBeLessThan(20);
    await expect.element(panel).not.toBeInTheDocument();

    await agent.click();
    await expect.element(panel).toBeVisible();
    await expect.element(agent).not.toBeInTheDocument();
    const window = panel.element().closest('[role="dialog"]')!.getBoundingClientRect();
    expect(window.width).toBeLessThanOrEqual(361);
    expect(window.height).toBeLessThanOrEqual(421);
    await expect.element(run).toBeDisabled();
    await draft.fill("Hello");
    await run.click();
    await expect.poll(() => result.element().textContent).toContain("Ask me about the party");
    await expect.element(draft).toHaveValue("");

    available.value = false;
    await expect.element(page.getByTestId("prototype-agent-offline")).toBeVisible();
    await draft.fill("Who is in the party?");
    await expect.element(run).toBeDisabled();
    await page.getByTestId("agent-chat-close").click();
    await expect.element(panel).not.toBeInTheDocument();
    await expect.element(agent).toBeVisible();

    await history.click();
    await expect.element(page.getByTestId("make-roll")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByTestId("make-roll")).not.toBeInTheDocument();
    await agent.click();
    await expect.element(draft).toHaveValue("Who is in the party?");
    await expect.poll(() => result.element().textContent).toContain("Ask me about the party");

    available.value = true;
    await draft.click();
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => result.element().textContent)
      .toContain("At the table today: Rowan Ash, Nera Vale.");
    await expect.element(draft).toHaveValue("");
  } finally {
    app.unmount();
    root.remove();
  }
});
