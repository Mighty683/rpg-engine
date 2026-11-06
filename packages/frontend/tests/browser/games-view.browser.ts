import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../src/shared/i18n";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
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
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient: new QueryClient() });
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
      return new Response(
        JSON.stringify({ systems: [{ id: "fabula-ultima", name: "Fabula Ultima" }] }),
      );
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
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient: new QueryClient() });
  app.mount(root);
  try {
    await page.getByTestId("open-game-creation").click();
    await page.getByTestId("game-system").click();
    await page.getByTestId("game-system-option-fabula-ultima").click();
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
      systemId: "fabula-ultima",
    });
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});

test("player creation retry reuses the same client id", async () => {
  const ids: string[] = [];
  let postAttempts = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/games/g1"))
      return new Response(
        JSON.stringify({
          game: { id: "g1", name: "Test", system: { id: "fabula-ultima", name: "Fabula Ultima" } },
        }),
      );
    if (url.endsWith("/players") && !init?.method)
      return new Response(JSON.stringify({ players: [] }));
    if (url.endsWith("/players") && init?.method === "POST") {
      const bodyText = typeof init.body === "string" ? init.body : "{}";
      const body = JSON.parse(bodyText) as { id: string; name: string };
      ids.push(body.id);
      postAttempts += 1;
      if (postAttempts === 1)
        return new Response(JSON.stringify({ error: { code: "unknown" } }), { status: 500 });
      return new Response(
        JSON.stringify({ player: { id: body.id, name: body.name, activeCharacter: null } }),
        { status: 201 },
      );
    }
    return new Response(JSON.stringify({ games: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/games/:gameId",
        component: (await import("../../src/modules/games/GameView.vue")).default,
      },
    ],
  });
  await router.push("/games/g1");
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient: new QueryClient() });
  app.mount(root);
  try {
    const playerName = page.getByTestId("player-name");
    await expect.element(playerName).toBeVisible();
    await playerName.fill("Alex");
    await page.getByTestId("add-player").click();
    await expect.element(page.getByTestId("player-create-error")).toBeVisible();
    await page.getByTestId("add-player").click();
    await expect.poll(() => ids.length).toBe(2);
    expect(ids[0]).toBe(ids[1]);
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});
