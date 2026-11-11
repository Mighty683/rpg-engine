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
    const visibility = document.querySelector<HTMLSelectElement>('[data-testid="npc-visibility"]')!;
    expect(visibility.value).toBe("hidden");
    visibility.value = "known";
    visibility.dispatchEvent(new Event("change", { bubbles: true }));
    await page.getByTestId("npc-level").fill("10");
    await page.getByTestId("attribute-die-DEX").click();
    await page.getByTestId("attribute-die-option-10").click();
    await page.getByTestId("defense-DEF").fill("10");
    await page.getByTestId("character-hp").fill("40");
    await page.getByTestId("maximum-button-HP").click();
    await page.getByTestId("maximum-input-HP").fill("60");
    await page.getByTestId("npc-name").click();
    await expect.element(page.getByTestId("maximum-button-HP")).toHaveTextContent("60");
    await expect.element(page.getByTestId("character-hp")).toHaveValue(40);
    await expect.element(page.getByTestId("tag-input")).not.toBeInTheDocument();
    await page.getByTestId("save-npc").click();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Lantern Guide");
    await page.getByTestId("npc-name").fill("Lantern Keeper");
    await page.getByTestId("save-npc").click();
    await expect
      .poll(async () => {
        const result = await (await fetch("/api/prototype/npcs")).json();
        return result.npcs.some(
          (npc: {
            name: string;
            level: number;
            baseDice: { DEX: number };
            defense: number;
            hp: { current: number; max: number };
          }) =>
            npc.name === "Lantern Keeper" &&
            npc.level === 10 &&
            npc.baseDice.DEX === 10 &&
            npc.defense === 10 &&
            npc.hp.current === 40 &&
            npc.hp.max === 60,
        );
      })
      .toBe(true);
    await userEvent.keyboard("{Escape}");
    await page.getByTestId("edge-tab-npcs").click();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Lantern Keeper");
    await expect.element(page.getByTestId("attribute-die-DEX")).toHaveTextContent("d10");
    table.role.value = "Player";
    await expect.element(page.getByTestId("edge-tab-npcs")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("npc-sheet")).not.toBeInTheDocument();
    await page.getByTestId("edge-tab-sheets").click();
    await expect.element(page.getByTestId("character-name")).toBeDisabled();
    await expect.element(page.getByTestId("save-character")).not.toBeInTheDocument();
  } finally {
    table.cleanup();
  }
});

test("NPC attacks and notes save to the card, can be edited and removed, and retain hidden abilities", async () => {
  const table = await mountTable();
  try {
    const card = page.getByTestId("npc-card-goblin-soldier");
    const knight = document.querySelector('[data-testid="npc-card-dark-knight"]')!;
    expect(knight.textContent).not.toMatch(/Accuracy \+|Vulnerable:|Immune:|Resistant:/);
    expect(knight.textContent).not.toContain("Elite");
    expect(knight.textContent).not.toContain("×2");
    expect(knight.querySelector('[data-testid="npc-notes"]')?.textContent).toContain(
      "Commands a squad of skeletal soldiers.",
    );
    expect(
      document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent,
    ).not.toMatch(/Crisis|INIT/);
    await expect.element(card.getByTestId("toggle-abilities")).not.toBeInTheDocument();
    await expect
      .element(card.getByTestId("npc-notes"))
      .toHaveTextContent("Often found in pairs near the old watchtower.");
    await card.getByTestId("edit-npc").click();
    await expect.element(page.getByTestId("defense-CRISIS")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("defense-INIT")).not.toBeInTheDocument();
    await page.getByTestId("attack-name-0").fill("Guard blade");
    await page.getByTestId("add-attack").click();
    await page.getByTestId("attack-name-2").fill("Flame bolt");
    await page.getByTestId("attack-damage-2").fill("9");
    await page.getByTestId("attack-damage-type-2").fill("fire and shadow");
    for (const [testId, value] of [
      ["attack-range-2", "ranged"],
      ["attack-attribute-2-0", "INS"],
      ["attack-attribute-2-1", "WLP"],
    ]) {
      const select = document.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`)!;
      select.value = value!;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await page.getByTestId("npc-sheet").getByLabelText("NPC notes").fill("Protects the gate.");
    await page.getByTestId("save-npc").click();
    await userEvent.keyboard("{Escape}");
    await card.getByTestId("toggle-attacks").click();
    await expect
      .poll(() => document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent)
      .toContain("Guard blade");
    await expect
      .poll(() => document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent)
      .toContain("Flame bolt");
    const cardText = document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent;
    expect(cardText).toContain("+9 fire and shadow");
    expect(cardText).not.toContain("high roll");
    await expect.element(card.getByTestId("npc-notes")).toHaveTextContent("Protects the gate.");
    const result = await (await fetch("/api/prototype/npcs")).json();
    const goblin = result.npcs.find((npc: { id: string }) => npc.id === "goblin-soldier");
    expect(goblin.attacks[2]).toMatchObject({
      name: "Flame bolt",
      range: "ranged",
      attributes: ["INS", "WLP"],
      damageBonus: 9,
      damageType: "fire and shadow",
    });
    expect(goblin).not.toHaveProperty("rank");
    expect(goblin.abilities[0].name).toBe("Skirmish");
    await card.getByTestId("edit-npc").click();
    await expect.element(page.getByTestId("attack-damage-type-2")).toHaveValue("fire and shadow");
    await expect.element(page.getByTestId("npc-rank")).not.toBeInTheDocument();
    await page.getByTestId("remove-attack-2").click();
    await page.getByTestId("save-npc").click();
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() => document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent)
      .not.toContain("Flame bolt");
  } finally {
    table.cleanup();
  }
});

test("NPC relationships persist on cards and removal requires confirmation", async () => {
  const table = await mountTable();
  try {
    const card = page.getByTestId("npc-card-goblin-soldier");
    const cardElement = () => document.querySelector('[data-testid="npc-card-goblin-soldier"]');
    expect(cardElement()?.getAttribute("data-relationship")).toBe("neutral");
    await card.getByTestId("edit-npc").click();
    expect(
      (document.querySelector('[data-testid="npc-relationship-neutral"]') as HTMLInputElement)
        .checked,
    ).toBe(true);
    for (const relationship of ["enemy", "friend", "neutral"]) {
      await page.getByTestId(`npc-relationship-${relationship}`).click();
      await page.getByTestId("save-npc").click();
      await expect.poll(() => cardElement()?.getAttribute("data-relationship")).toBe(relationship);
      const result = await (await fetch("/api/prototype/npcs")).json();
      expect(
        result.npcs.find((npc: { id: string }) => npc.id === "goblin-soldier").relationship,
      ).toBe(relationship);
    }
    await page.getByTestId("remove-npc").click();
    await page.getByTestId("cancel-remove-npc").click();
    await expect.element(card).toBeVisible();
    await page.getByTestId("remove-npc").click();
    await page.getByTestId("confirm-remove-npc").click();
    await expect.element(card).not.toBeInTheDocument();
    const result = await (await fetch("/api/prototype/npcs")).json();
    expect(result.npcs.some((npc: { id: string }) => npc.id === "goblin-soldier")).toBe(false);
    await expect.element(page.getByTestId("remove-npc")).not.toBeInTheDocument();
  } finally {
    table.cleanup();
  }
});

test("GM controls player visibility without exposing hidden or redacted NPC details in the UI", async () => {
  const table = await mountTable();
  try {
    for (const [id, visibility] of [
      ["forest-spider", "hidden"],
      ["goblin-soldier", "visible"],
    ]) {
      await page.getByTestId(`npc-card-${id}`).getByTestId("edit-npc").click();
      const select = document.querySelector<HTMLSelectElement>('[data-testid="npc-visibility"]')!;
      select.value = visibility!;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await page.getByTestId("save-npc").click();
      await expect
        .poll(async () => {
          const result = await (await fetch("/api/prototype/npcs")).json();
          return result.npcs.find((npc: { id: string }) => npc.id === id)?.visibility;
        })
        .toBe(visibility);
      await expect
        .element(page.getByTestId(`npc-card-${id}`).getByTestId("npc-visibility-badge"))
        .not.toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
    }
    table.role.value = "Player";
    await expect.element(page.getByTestId("npc-card-forest-spider")).not.toBeInTheDocument();
    const goblin = page.getByTestId("npc-card-goblin-soldier");
    await expect.element(goblin).toBeVisible();
    const text = document.querySelector('[data-testid="npc-card-goblin-soldier"]')!.textContent!;
    expect(text).toContain("Goblin Sentry");
    expect(text).not.toContain("Soldier");
    expect(text).toContain("???");
    expect(text).not.toMatch(/Lv 5|d8|50|Rusty Blade|watchtower/);
    await expect.element(goblin.getByTestId("edit-npc")).not.toBeInTheDocument();
    await expect
      .element(page.getByTestId("npc-card-dark-knight").getByTestId("npc-hp"))
      .toHaveTextContent("140 / 140");
    await expect
      .element(page.getByTestId("npc-card-dark-knight").getByTestId("npc-notes"))
      .not.toBeInTheDocument();
    await expect.element(page.getByTestId("edge-tab-npcs")).not.toBeInTheDocument();
    await expect.element(page.getByTestId("npc-sheet")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Giant Forest Spider");
  } finally {
    table.cleanup();
  }
});

test("player examples cover each visible relationship and hide hidden NPCs", async () => {
  const table = await mountTable("Player");
  try {
    await expect.element(page.getByTestId("edge-tab-npcs")).not.toBeInTheDocument();
    for (const [id, relationship, redacted] of [
      ["goblin-soldier", "neutral", false],
      ["dark-knight", "enemy", false],
      ["forest-spider", "friend", false],
      ["visible-enemy", "enemy", true],
      ["visible-neutral", "neutral", true],
      ["visible-friend", "friend", true],
    ] as const) {
      const card = document.querySelector(`[data-testid="npc-card-${id}"]`)!;
      expect(card.getAttribute("data-relationship")).toBe(relationship);
      expect(card.textContent?.includes("???")).toBe(redacted);
    }
    await expect.element(page.getByTestId("npc-card-hidden-npc")).not.toBeInTheDocument();
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

test("a rejected NPC save keeps the draft and leaves the saved record unchanged", async () => {
  const table = await mountTable();
  try {
    prototypeWorker.use(
      http.put("*/api/prototype/npcs/:id", () =>
        HttpResponse.json({ error: "save_rejected" }, { status: 500 }),
      ),
    );
    await page.getByTestId("npc-card-goblin-soldier").getByTestId("edit-npc").click();
    await page.getByTestId("npc-name").fill("Unsaved goblin");
    await page.getByTestId("save-npc").click();
    await expect.element(page.getByTestId("table-error")).toBeVisible();
    await expect.element(page.getByTestId("npc-name")).toHaveValue("Unsaved goblin");
    await expect
      .poll(() => document.querySelector('[data-testid="npc-card-goblin-soldier"]')?.textContent)
      .toContain("Goblin Sentry");
    const result = await (await fetch("/api/prototype/npcs")).json();
    expect(result.npcs.find((npc: { id: string }) => npc.id === "goblin-soldier").name).toBe(
      "Goblin Sentry",
    );
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
