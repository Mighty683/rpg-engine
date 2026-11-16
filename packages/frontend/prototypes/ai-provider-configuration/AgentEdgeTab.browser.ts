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

test("Agent shares the table edge and keeps an offline draft until it can run", async () => {
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
    const agent = page.getByTestId("edge-tab-agent");
    const history = page.getByTestId("edge-tab-history");
    const panel = page.getByTestId("prototype-agent-panel");
    const draft = page.getByTestId("prototype-agent-command");
    const run = page.getByTestId("prototype-agent-submit");
    const result = page.getByTestId("prototype-agent-result");

    await expect.element(page.getByTestId("party-list")).toBeVisible();
    await expect.element(agent).toBeVisible();
    expect(agent.element().parentElement).toBe(history.element().parentElement);
    await expect.element(panel).not.toBeInTheDocument();

    await agent.click();
    await expect.element(panel).toBeVisible();
    await expect.element(run).toBeDisabled();
    await draft.fill("Unsupported command");
    await run.click();
    await expect.poll(() => result.element().textContent).toContain("Try “Show active party”");
    await expect.element(draft).toHaveValue("Unsupported command");

    available.value = false;
    await expect.element(page.getByTestId("prototype-agent-offline")).toBeVisible();
    await page.getByTestId("prototype-agent-example").click();
    await expect.element(run).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect.element(panel).not.toBeInTheDocument();

    await history.click();
    await expect.element(page.getByTestId("make-roll")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByTestId("make-roll")).not.toBeInTheDocument();
    await agent.click();
    await expect.element(draft).toHaveValue("Show active party");

    available.value = true;
    await draft.click();
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => result.element().textContent)
      .toContain("Active party: Rowan Ash, Nera Vale.");
    await expect.element(draft).toHaveValue("");
  } finally {
    app.unmount();
    root.remove();
  }
});
