/** Regression coverage against the same HTTP/MSW persistence used by Histoire. */
import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import { createMemoryHistory, createRouter } from "vue-router";
import { createFrontendI18n } from "../../src/shared/i18n";
import {
  providePrototypeApiServices,
  prototypeApiServices,
  prototypeGameId,
  resetPrototypeBackend,
} from "../api";
import { startPrototypeBackend } from "../mock-backend/browser";
import GameTableWithNpcs from "./GameTableWithNpcs.vue";
import type { TableRole } from "./types";
import { http, HttpResponse } from "msw";
import { prototypeWorker } from "../mock-backend/browser";
import "../../src/style.css";

async function mountTable(initialRole: TableRole = "GM") {
  await startPrototypeBackend();
  resetPrototypeBackend();
  const role = ref(initialRole);
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({ setup: () => () => h(GameTableWithNpcs, { role: role.value }) }),
  );
  providePrototypeApiServices(app);
  app
    .use(ui)
    .use(createFrontendI18n())
    .use(
      createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/", component: defineComponent({ render: () => null }) }],
      }),
    );
  app.mount(root);
  await expect.element(page.getByTestId("party-rowan")).toBeVisible();
  return {
    role,
    cleanup: () => {
      app.unmount();
      root.remove();
      prototypeWorker.resetHandlers();
    },
  };
}

test("editing either selected sheet persists only that character and refreshes both displayed cards", async () => {
  const table = await mountTable();
  try {
    await page.getByTestId("party-rowan").getByTestId("edit-character").click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Rowan Ash");
    await page.getByTestId("character-name").fill("Rowan Updated");
    await page.getByTestId("tag-input").fill("Vanguard");
    await page.getByTestId("add-tag").click();
    await page.getByTestId("save-character").click();
    await page.getByTestId("close-sheets").click();
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Updated");
    await page.getByTestId("party-nera").getByTestId("edit-character").click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Nera Vale");
    await page.getByTestId("character-name").fill("Nera Updated");
    await page.getByTestId("save-character").click();
    await page.getByTestId("close-sheets").click();
    await expect
      .poll(() => document.querySelector('[data-testid="party-nera"]')?.textContent)
      .toContain("Nera Updated");
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Updated");
    await page.getByTestId("edge-tab-sheets").click();
    await page.getByTestId("sheet-tab-rowan").click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Rowan Updated");
    const party = await prototypeApiServices.gameTable.getGameParty(prototypeGameId);
    expect(party.characters.map((member) => member.name)).toEqual([
      "Rowan Updated",
      "Nera Updated",
    ]);
    expect(party.characters[0]?.tags).toContainEqual({ name: "Vanguard", color: "primary" });
    expect(party.characters[1]?.tags).not.toContainEqual({ name: "Vanguard", color: "primary" });
  } finally {
    table.cleanup();
  }
});

test("NPC create and edit survive closing and reopening the sheet; player sheets remain read-only", async () => {
  const table = await mountTable();
  try {
    await page.getByTestId("add-npc").click();
    await page.getByTestId("npc-name").fill("Lantern Guide");
    await page.getByTestId("tag-input").fill("Ally");
    await page.getByTestId("add-tag").click();
    await page.getByTestId("save-npc").click();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Lantern Guide");
    await page.getByTestId("npc-name").fill("Lantern Keeper");
    await page.getByTestId("save-npc").click();
    await expect
      .poll(async () => {
        const result = await (await fetch("/api/prototype/npcs")).json();
        return result.npcs.some(
          (npc: { name: string; tags: { name: string }[] }) =>
            npc.name === "Lantern Keeper" && npc.tags.some((tag) => tag.name === "Ally"),
        );
      })
      .toBe(true);
    await page.getByTestId("close-npcs").click();
    await page.getByTestId("edge-tab-npcs").click();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Lantern Keeper");
    table.role.value = "Player";
    await expect.element(page.getByTestId("npc-name")).toBeDisabled();
    await expect.element(page.getByTestId("save-npc")).not.toBeInTheDocument();
    await page.getByTestId("close-npcs").click();
    await page.getByTestId("edge-tab-sheets").click();
    await expect.element(page.getByTestId("character-name")).toBeDisabled();
    await expect.element(page.getByTestId("save-character")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("readonly-character-tags")).toBeInTheDocument();
  } finally {
    table.cleanup();
  }
});

test("a rejected save retains the draft, shows an error, and does not change the persisted card", async () => {
  const table = await mountTable();
  try {
    prototypeWorker.use(
      http.patch("*/api/games/:gameId/characters/:id", () =>
        HttpResponse.json({ error: { code: "save_rejected" } }, { status: 403 }),
      ),
    );
    await page.getByTestId("party-rowan").getByTestId("edit-character").click();
    await page.getByTestId("character-name").fill("Unsaved name");
    await page.getByTestId("save-character").click();
    await expect
      .poll(() => document.querySelector('[data-testid="table-error"]')?.textContent)
      .toBeTruthy();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Unsaved name");
    await page.getByTestId("close-sheets").click();
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Ash");
    const result = await prototypeApiServices.characters.getGameCharacter(prototypeGameId, "rowan");
    expect(result.character.sheet.name).toBe("Rowan Ash");
  } finally {
    table.cleanup();
  }
});

test("canceling a sheet switch preserves unsaved edits", async () => {
  const table = await mountTable();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    await page.getByTestId("party-rowan").getByTestId("edit-character").click();
    await page.getByTestId("character-name").fill("Keep this draft");
    await page.getByTestId("sheet-tab-nera").click();
    expect(confirm).toHaveBeenCalledWith("Discard unsaved character changes and switch sheets?");
    await expect.element(page.getByTestId("character-name")).toHaveValue("Keep this draft");
    confirm.mockReturnValue(true);
    await page.getByTestId("sheet-tab-nera").click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Nera Vale");
  } finally {
    confirm.mockRestore();
    table.cleanup();
  }
});
