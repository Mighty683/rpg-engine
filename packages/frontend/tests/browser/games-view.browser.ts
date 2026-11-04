import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../src/shared/i18n";
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
  const app = createApp(App).use(router).use(ui).use(createFrontendI18n());
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

test("game creation validates the name and submits trimmed values", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ game: { name: "My game" } }), { status: 201 });
    }
    if (typeof input === "string" && input.includes("rpg-systems")) {
      return new Response(JSON.stringify({ systems: [{ id: "dnd", name: "D&D" }] }));
    }
    return new Response(JSON.stringify({ games: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: GamesView }],
  });
  await router.push("/");
  const app = createApp(App).use(router).use(ui).use(createFrontendI18n());
  app.mount(root);
  try {
    await page.getByTestId("open-game-creation").click();
    await page.getByTestId("game-system").click();
    await page.getByTestId("game-system-option-dnd").click();
    await page.getByTestId("game-name").fill("   ");
    await page.getByTestId("submit-game").click();
    await expect
      .element(page.getByTestId("game-name-field"))
      .toHaveTextContent("Game nameMaximum 20 characters.Enter a game name");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await page.getByTestId("game-name").fill("  My game  ");
    await page.getByTestId("submit-game").click();
    await expect.element(page.getByTestId("game-created-toast")).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      name: "My game",
      systemId: "dnd",
    });
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});
