import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../shared/i18n";
import CharacterView from "./CharacterView.vue";
import App from "../../App.vue";
import "../../style.css";

const sheet = () => ({
  name: "Camilla",
  theme: null,
  level: 5,
  baseDice: { DEX: 8, INS: 10, MIG: 6, WLP: 8 },
  classes: [],
  skills: [],
  equipment: [],
  resources: { hp: 35, mp: 45, ip: 6, fabula: 3 },
  overrides: {
    maxHp: null,
    maxMp: null,
    maxIp: null,
    defense: null,
    magicDefense: null,
    initiative: null,
  },
});
async function mount(fetchMock: ReturnType<typeof vi.fn>, canEdit = true) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/auth/me")) return Promise.resolve(new Response(JSON.stringify({ account: { id: "p1", username: "Player" } })));
    if (String(input).endsWith("/characters") && !init?.method) return Promise.resolve(new Response(JSON.stringify({ characters: [{ id: "c1", controllerMembershipId: null, controllerName: null, canEdit }] })));
    return (fetchMock as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)(input, init);
  });
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/games/:gameId/players/:playerId/characters/:characterId",
        component: CharacterView,
      },
    ],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await router.push("/games/g1/players/p1/characters/c1");
  await router.isReady();
  const app = createApp(App)
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, { queryClient });
  app.mount(root);
  return { app, root };
}
function response(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      character: {
        id: "c1",
        playerId: "p1",
        name: "Camilla",
        level: 5,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        revision: 0,
        systemId: "fabula-ultima",
        sheet: { ...sheet(), ...overrides },
        derived: { coverage: "partial", maxima: { hp: 35, mp: 45, ip: 6 }, defenses: {} },
      },
    }),
  );
}

test("read-only sheets explain control and keep informational help focusable", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  const mounted = await mount(fetchMock, false);
  try {
    await expect.element(page.getByTestId("character-controller")).toHaveTextContent("Controlled by the GM. You can view this sheet but cannot edit it.");
    await expect.element(page.getByTestId("character-name")).toBeDisabled();
    const help = mounted.root.querySelector<HTMLElement>('[data-testid="info-tooltip"]');
    expect(help?.tabIndex).toBe(0);
    help?.focus();
    expect(document.activeElement).toBe(help);
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("sheet saves edits and preserves a newer input during a slow acknowledgement", async () => {
  let resolvePatch!: (value: Response) => void;
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH")
      return new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      });
    return Promise.resolve(response());
  });
  const mounted = await mount(fetchMock);
  try {
    await expect.element(page.getByTestId("character-name")).toBeVisible();
    await page.getByTestId("character-name").fill("Updated");
    await page.getByTestId("character-theme").fill("Storm");
    await expect.element(page.getByTestId("save-status")).toHaveTextContent("Saving…");
    resolvePatch(response({ name: "Updated", theme: "Storm" }));
    await expect.element(page.getByTestId("character-name")).toHaveValue("Updated");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("characters/c1"),
      expect.objectContaining({ method: "PATCH" }),
    );
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("editing lock persists across remount and blocks edits", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  const first = await mount(fetchMock);
  try {
    await expect.element(page.getByTestId("editing-lock")).toBeVisible();
    await page.getByTestId("editing-lock").click();
  } finally {
    first.app.unmount();
    first.root.remove();
  }
  const second = await mount(fetchMock);
  try {
    await expect.element(page.getByTestId("editing-lock")).toHaveTextContent("Unlock editing");
    await expect.element(page.getByTestId("character-name")).toBeDisabled();
    const patchesBefore = (fetchMock.mock.calls as unknown[][]).filter(
      (call) => (call[1] as RequestInit | undefined)?.method === "PATCH",
    ).length;
    await expect.element(page.getByTestId("character-name")).toBeDisabled();
    expect(
      (fetchMock.mock.calls as unknown[][]).filter(
        (call) => (call[1] as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(patchesBefore);
  } finally {
    second.app.unmount();
    second.root.remove();
    localStorage.removeItem("character-lock:c1");
    vi.unstubAllGlobals();
  }
});

test("known validation rejection rolls the sheet back", async () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH"
      ? Promise.resolve(
          new Response(JSON.stringify({ error: { code: "validation" } }), { status: 422 }),
        )
      : Promise.resolve(response()),
  );
  const mounted = await mount(fetchMock);
  try {
    await expect.element(page.getByTestId("character-theme")).toBeVisible();
    await page.getByTestId("character-theme").fill("Rejected");
    await page.getByTestId("character-name").click();
    await expect.element(page.getByTestId("character-theme")).toHaveValue("");
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("conflict keeps the draft and offers the latest saved sheet", async () => {
  let reads = 0;
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH")
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: "stale_revision" } }), { status: 409 }),
      );
    reads += 1;
    return Promise.resolve(response(reads > 1 ? { theme: "Authoritative" } : {}));
  });
  const mounted = await mount(fetchMock);
  try {
    await page.getByTestId("character-theme").fill("Stale");
    await expect.element(page.getByTestId("save-status")).toHaveTextContent("Your changes could not be confirmed. Your local draft is shown above.Discard draft and reload");
    const themes = mounted.root.querySelectorAll<HTMLInputElement>('[data-testid="character-theme"]');
    expect([...themes].map((input) => input.value)).toEqual(["Stale", "Authoritative"]);
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("keeps a resource edit made while a theme save is awaiting acknowledgement", async () => {
  const resolvers: Array<(value: Response) => void> = [];
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH")
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    return Promise.resolve(response());
  });
  const mounted = await mount(fetchMock);
  try {
    await page.getByTestId("character-theme").fill("Storm");
    await page.getByTestId("character-name").click();
    await page.getByTestId("character-hp").fill("40");
    await page.getByTestId("character-theme").click();
    await expect.poll(() => resolvers.length).toBe(1);
    resolvers[0]!(response({ theme: "Storm" }));
    await expect.poll(() => resolvers.length).toBe(2);
    resolvers[1]!(response({ theme: "Storm", resources: { ...sheet().resources, hp: 40 } }));
    await expect.element(page.getByTestId("character-theme")).toHaveValue("Storm");
    await expect.element(page.getByTestId("character-hp")).toHaveValue(40);
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("does not persist blank or invalid transient resource input", async () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH" ? Promise.resolve(response()) : Promise.resolve(response()),
  );
  const mounted = await mount(fetchMock);
  try {
    await page.getByTestId("character-hp").fill("");
    await page.getByTestId("character-hp").fill("-1");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      (fetchMock.mock.calls as unknown[][]).filter(
        (call) => (call[1] as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(0);
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("resource maximum overrides remain editable", async () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return Promise.resolve(response({ overrides: { ...sheet().overrides, maxHp: 50 } }));
    }
    return Promise.resolve(response());
  });
  const mounted = await mount(fetchMock);
  try {
    await page.getByTestId("maximum-button-HP").click();
    await page.getByTestId("maximum-input-HP").fill("50");
    page
      .getByTestId("maximum-input-HP")
      .element()
      .dispatchEvent(new Event("change", { bubbles: true }));
    await expect.element(page.getByTestId("maximum-button-HP")).toHaveTextContent("50");
    const patch = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string).changes.overrides.maxHp).toBe(50);
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});

test("equipment status appears only on equipable items", async () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      response({
        classes: [{ id: "class-1", name: "Guardian", notes: "" }],
        skills: [{ id: "skill-1", name: "Guard", notes: "" }],
        equipment: [
          {
            id: "weapon-1",
            name: "Sword",
            notes: "",
            priceZenit: null,
            kind: "weapon",
            equipped: true,
            accuracyDice: [null, null],
            accuracyBonus: null,
          },
          {
            id: "armor-1",
            name: "Armor",
            notes: "",
            priceZenit: null,
            kind: "armor",
            equipped: false,
            fixedDefense: null,
            defenseBonus: 0,
            magicDefenseBonus: 0,
            initiativeModifier: 0,
          },
          { id: "item-1", name: "Rope", notes: "", priceZenit: null, kind: "other" },
        ],
      }),
    ),
  );
  const mounted = await mount(fetchMock);
  try {
    await expect.element(page.getByTestId("remove-class-1")).toBeVisible();
    const cardText = (id: string) =>
      page.getByTestId(`remove-${id}`).element().closest("article")?.textContent ?? "";
    expect(cardText("class-1")).not.toContain("equipped");
    expect(cardText("skill-1")).not.toContain("equipped");
    expect(cardText("item-1")).not.toContain("equipped");
    expect(cardText("weapon-1")).toContain("Equipped");
    expect(cardText("armor-1")).toContain("Not equipped");
  } finally {
    mounted.app.unmount();
    mounted.root.remove();
    vi.unstubAllGlobals();
  }
});
