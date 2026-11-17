import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import AgentEditReview from "./AgentEditReview.vue";
import AgentRollCard from "./AgentRollCard.vue";
import "../../style.css";

test("inline cards show the proposed action and delegate confirmation and cancellation", async () => {
  const onRoll = vi.fn(async (_private: boolean) => {});
  const accept = vi.fn(async () => {});
  const dismiss = vi.fn();
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { render: () => null } }],
  });
  await router.push("/");
  const app = createApp({
    render: () =>
      h(UApp, null, {
        default: () => [
          h(AgentRollCard, {
            summary: { name: "GM", formula: "d10 + d10", sizes: [10, 10] },
            initiallyPrivate: true,
            submitting: false,
            onRoll,
          }),
          h(AgentEditReview, {
            profile: "Mira",
            diff: [{ field: "Current HP", oldValue: 50, newValue: 45 }],
            busy: false,
            notice: "",
            accept,
            dismiss,
          }),
        ],
      }),
  })
    .use(router)
    .use(ui);
  app.mount(root);
  try {
    expect(page.getByTestId("agent-roll-preview").element().textContent).toContain("d10 + d10");
    await page.getByTestId("agent-make-roll").click();
    expect(onRoll).toHaveBeenCalledExactlyOnceWith(true);
    expect(page.getByTestId("agent-edit-diff").element().textContent).toContain("50 → 45");
    await page.getByTestId("agent-accept-edit").click();
    await page.getByTestId("agent-cancel-edit").click();
    expect(accept).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
  } finally {
    app.unmount();
    root.remove();
  }
});
