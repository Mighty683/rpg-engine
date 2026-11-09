import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import UApp from "@nuxt/ui/components/App.vue";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../shared/i18n";
import { account } from "../auth/session";
import GameTable from "./GameTable.vue";
import "../../style.css";

const character = {
  id: "character-1",
  revision: 0,
  name: "Hero",
  classes: [],
  baseDice: { DEX: 8, INS: 8, MIG: 6, WLP: 6 },
  resources: { hp: 10, mp: 10, ip: 5, fabula: 3 },
  maxima: { hp: 10, mp: 10, ip: 5 },
  defense: 8,
  magicDefense: 8,
  weapons: [],
  canRoll: true,
};

async function mountTable(post: (body: unknown) => Promise<Response>) {
  let revision = 0;
  let historyReads = 0;
  const submissions: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/auth/csrf")) return Response.json({ csrfToken: "test-token" });
      if (url.includes("/throws") && init?.method === "POST") {
        if (typeof init.body !== "string") throw new Error("Expected a JSON request body");
        const body = JSON.parse(init.body);
        submissions.push(body);
        return post(body);
      }
      if (url.includes("/throws")) {
        historyReads++;
        return Response.json({ throws: [] });
      }
      if (url.endsWith("/party"))
        return Response.json({ characters: [{ ...character, revision }] });
      if (url.endsWith("/characters")) return Response.json({ characters: [] });
      if (url.endsWith("/members")) return Response.json({ members: [] });
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
  account.value = { id: "gm", username: "gm" };
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: GameTable }],
  });
  await router.push("/");
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(UApp, null, {
          default: () => h(GameTable, { gameId: "game-1", role: "GM", throwsHint: 0 }),
        }),
    }),
  );
  app
    .use(router)
    .use(ui)
    .use(createFrontendI18n())
    .use(VueQueryPlugin, {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    });
  app.mount(root);
  await expect.element(page.getByTestId("roll-attribute-DEX")).toBeVisible();
  return {
    submissions,
    historyReads: () => historyReads,
    setRevision: (value: number) => {
      revision = value;
    },
    cleanup: () => {
      app.unmount();
      root.remove();
      account.value = null;
      vi.unstubAllGlobals();
    },
  };
}

test("a pending roll cannot be submitted twice, and an uncertain response refreshes history", async () => {
  let rejectRoll!: (reason: Error) => void;
  const table = await mountTable(
    () =>
      new Promise<Response>((_resolve, reject) => {
        rejectRoll = reject;
      }),
  );
  try {
    await page.getByTestId("make-roll").click();
    await page.getByTestId("add-die-d8").click();
    await page.getByTestId("submit-free-roll").click();
    await expect.element(page.getByTestId("submit-free-roll")).toBeDisabled();
    expect(table.submissions).toHaveLength(1);
    expect(table.submissions[0]).toMatchObject({
      sourceThrowId: null,
      setup: { type: "free", dice: [8] },
    });
    const initialReads = table.historyReads();
    rejectRoll(new Error("connection lost"));
    await expect.poll(() => table.historyReads()).toBeGreaterThan(initialReads);
    await expect.element(page.getByTestId("free-roll-dialog")).not.toBeInTheDocument();
    expect(document.body.textContent).toContain("Check history before rolling again");
  } finally {
    table.cleanup();
  }
});

test("a stale character roll closes and a new roll uses the refreshed revision", async () => {
  const table = await mountTable(async () =>
    Response.json({ error: { code: "stale_revision", message: "Sheet changed" } }, { status: 409 }),
  );
  try {
    await page.getByTestId("roll-attribute-DEX").click();
    table.setRevision(1);
    await page.getByTestId("submit-roll").click();
    await expect.element(page.getByTestId("roll-dialog")).not.toBeInTheDocument();
    await expect.poll(() => document.body.textContent).toContain("Open the roll again");
    await expect.poll(() => table.historyReads()).toBeGreaterThan(1);
    await page.getByTestId("roll-attribute-DEX").click();
    await page.getByTestId("submit-roll").click();
    await expect.poll(() => table.submissions.length).toBe(2);
    expect(table.submissions[0]).toMatchObject({ setup: { expectedRevision: 0 } });
    expect(table.submissions[1]).toMatchObject({ setup: { expectedRevision: 1 } });
  } finally {
    table.cleanup();
  }
});
