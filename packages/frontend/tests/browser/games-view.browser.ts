import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import App from "../../src/App.vue";
import GamesView from "../../src/modules/games/GamesView.vue";
import "../../src/style.css";

test("a GM can retry a failed game list without a backend", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ games: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: GamesView }],
  });
  await router.push("/");
  const app = createApp(App).use(router).use(ui);
  app.mount(root);
  try {
    await nextTick();
    await expect.element(page.getByTestId("games-load-error")).toBeVisible();
    await expect.element(page.getByTestId("open-game-creation")).toBeVisible();
    await page.getByTestId("retry-games").click();
    await expect.element(page.getByTestId("games-empty")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});
