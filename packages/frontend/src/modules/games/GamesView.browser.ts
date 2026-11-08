import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../shared/i18n";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import App from "../../App.vue";
import GamesView from "./GamesView.vue";
import "../../style.css";

const requestUrl = (input: RequestInfo | URL) => typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test("a GM can retry a failed game list without a backend", async () => {
  let attempts = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith("/auth/me")) return json({ account: { id: "a1", username: "gm" } });
    if (url.endsWith("/api/games") && ++attempts === 1) throw new Error("offline");
    return json({ games: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: GamesView }, { path: "/games/:gameId", component: { template: "<div>Game opened</div>" } }],
  });
  await router.push("/");
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) });
  app.mount(root);
  try {
    await nextTick();
    await expect.element(page.getByTestId("games-load-error-toast")).toBeVisible();
    await expect.element(page.getByTestId("open-game-creation")).toBeVisible();
    await page.getByTestId("retry-games").click();
    await expect.element(page.getByTestId("games-empty")).toBeVisible();
    expect(attempts).toBe(2);
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});

test("game creation validates the name and submits trimmed values", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (requestUrl(input).endsWith("/auth/me")) return json({ account: { id: "a1", username: "gm" } });
    if (requestUrl(input).endsWith("/auth/csrf")) return json({ csrfToken: "token" });
    if (init?.method === "POST") {
      return json({ game: { id: "g1", name: "My game" } }, 201);
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
    routes: [{ path: "/", component: GamesView }, { path: "/games/:gameId", component: { template: "<div>Game opened</div>" } }],
  });
  await router.push("/");
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) });
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
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    await page.getByTestId("game-name").fill("  My game  ");
    await page.getByTestId("submit-game").click();
    await expect.element(page.getByTestId("game-created-toast")).toBeVisible();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      name: "My game",
      systemId: "fabula-ultima",
    });
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});

test("character creation retry reuses the same client id", async () => {
  const ids: string[] = [];
  vi.stubGlobal("EventSource", class { close() {} });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url.endsWith("/auth/me")) return json({ account: { id: "a1", username: "gm" } });
    if (url.endsWith("/auth/csrf")) return json({ csrfToken: "token" });
    if (url.endsWith("/api/games/g1")) return json({ game: { id: "g1", name: "Test", role: "GM", system: { id: "fabula-ultima", name: "Fabula Ultima" } } });
    if (url.endsWith("/characters") && init?.method === "POST") {
      ids.push((JSON.parse(init.body as string) as { id: string }).id);
      return json({ error: { code: "unknown" } }, 500);
    }
    if (url.endsWith("/characters")) return json({ characters: [] });
    if (url.endsWith("/members")) return json({ members: [] });
    if (url.endsWith("/party")) return json({ characters: [] });
    if (url.includes("/throws")) return json({ throws: [] });
    return json({});
  }));
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/games/:gameId", component: (await import("./GameView.vue")).default }] });
  await router.push("/games/g1");
  const app = createApp(App).use(router).use(ui).use(createFrontendI18n()).use(VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) });
  app.mount(root);
  try {
    await page.getByTestId("create-character").click();
    await page.getByTestId("character-name").fill("Camilla");
    const submit = page.getByRole("dialog").getByRole("button", { name: "Create character" });
    await submit.click();
    await expect.poll(() => ids.length).toBe(1);
    await expect.element(page.getByText("Could not confirm character creation. Submit again to safely retry.")).toBeVisible();
    await submit.click();
    await expect.poll(() => ids.length).toBe(2);
    expect(ids[0]).toBe(ids[1]);
  } finally {
    app.unmount();
    root.remove();
    vi.unstubAllGlobals();
  }
});
