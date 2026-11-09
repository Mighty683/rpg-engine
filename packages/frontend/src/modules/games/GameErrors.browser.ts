import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import UApp from "@nuxt/ui/components/App.vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../shared/i18n";
import GamesView from "./GamesView.vue";
import "../../style.css";

test("API failures show toasts while retry and form input remain available", async () => {
  let listAttempts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({ error: { fields: { name: "Choose a different name." } } }),
          { status: 422 },
        );
      }
      if (url.includes("rpg-systems")) {
        return new Response(
          JSON.stringify({ systems: [{ id: "fabula-ultima", name: "Fabula Ultima" }] }),
        );
      }
      if (++listAttempts === 1) throw new Error("offline");
      return new Response(JSON.stringify({ games: [] }));
    }),
  );
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: GamesView }],
  });
  await router.push("/");
  const wrapper = defineComponent({
    setup: () => () => h(UApp, null, { default: () => h(RouterView) }),
  });
  const app = createApp(wrapper)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, {
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
  app.mount(root);
  try {
    await expect
      .element(page.getByTestId("games-load-error-toast"))
      .toHaveTextContent("Could not load games.");
    await page.getByTestId("retry-games").click();
    await expect.element(page.getByTestId("games-empty")).toBeVisible();
    await page.getByTestId("open-game-creation").click();
    await page.getByTestId("game-system").click();
    await page.getByTestId("game-system-option-fabula-ultima").click();
    await page.getByTestId("game-name").fill("My game");
    await page.getByTestId("submit-game").click();
    await expect.element(page.getByTestId("game-create-error-toast")).toBeVisible();
    await expect.element(page.getByTestId("game-name")).toHaveValue("My game");
    expect(root.querySelector('[data-testid="game-name-field"]')?.textContent).not.toContain(
      "Choose a different name.",
    );
    expect(document.body.textContent).toContain("Choose a different name.");
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});
