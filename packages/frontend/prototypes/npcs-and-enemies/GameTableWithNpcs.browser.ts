/** Regression coverage against the same HTTP/MSW persistence used by Histoire. */
import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
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
    await expect.element(page.getByTestId("save-status")).toHaveTextContent("Saved automatically");
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Updated");
    await page.getByTestId("party-nera").getByTestId("edit-character").click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Nera Vale");
    await page.getByTestId("character-name").fill("Nera Updated");
    await expect.element(page.getByTestId("save-status")).toHaveTextContent("Saved automatically");
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() => document.querySelector('[data-testid="party-nera"]')?.textContent)
      .toContain("Nera Updated");
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Updated");
    await page.getByTestId("edge-tab-sheets").click();
    await page.getByTestId("sheet-tab").filter({ hasText: "Rowan Updated" }).click();
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
    await expect.element(page.getByTestId("add-npc")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("close-npcs")).not.toBeInTheDocument();
    await page.getByTestId("edge-tab-npcs").click();
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
    await userEvent.keyboard("{Escape}");
    await page.getByTestId("edge-tab-npcs").click();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Lantern Keeper");
    table.role.value = "Player";
    await expect.element(page.getByTestId("npc-name")).toBeDisabled();
    await expect.element(page.getByTestId("save-npc")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
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
    await expect
      .poll(() => document.querySelector('[data-testid="save-status"]')?.textContent)
      .toContain("Your changes could not be confirmed");
    await expect
      .poll(() => document.querySelector('[data-testid="save-status"]')?.textContent)
      .toBeTruthy();
    await expect.element(page.getByTestId("character-name").first()).toHaveValue("Unsaved name");
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() => document.querySelector('[data-testid="party-rowan"]')?.textContent)
      .toContain("Rowan Ash");
    const result = await prototypeApiServices.characters.getGameCharacter(prototypeGameId, "rowan");
    expect(result.character.sheet.name).toBe("Rowan Ash");
  } finally {
    table.cleanup();
  }
});

test("production tabs select the requested sheet without prototype save controls", async () => {
  const table = await mountTable();
  try {
    await page.getByTestId("party-rowan").getByTestId("edit-character").click();
    await expect.element(page.getByTestId("save-character")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("close-sheets")).not.toBeInTheDocument();
    await page.getByTestId("sheet-tab").filter({ hasText: "Nera Vale" }).click();
    await expect.element(page.getByTestId("character-name")).toHaveValue("Nera Vale");
  } finally {
    table.cleanup();
  }
});

test("the prototype layout uses production free-roll validation and persisted history", async () => {
  const table = await mountTable();
  try {
    await page.getByTestId("edge-tab-history").click();
    await page.getByTestId("make-roll").click();
    await page.getByTestId("submit-free-roll").click();
    await expect
      .element(page.getByTestId("free-error"))
      .toHaveTextContent("Choose one or two friendly dice.");
    await page.getByTestId("add-die-d8").click();
    await page.getByTestId("submit-free-roll").click();
    await expect.element(page.getByTestId("free-roll-dialog")).not.toBeInTheDocument();
    await expect
      .poll(async () => {
        const result = await prototypeApiServices.gameTable.listGameThrows(prototypeGameId, {
          limit: 100,
        });
        return result.throws.length;
      })
      .toBeGreaterThan(0);
    await expect.element(page.getByTestId("throw-history")).toBeVisible();
  } finally {
    table.cleanup();
  }
});
