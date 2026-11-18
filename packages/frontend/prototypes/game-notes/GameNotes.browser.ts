import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { createApp, h } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createMemoryHistory, createRouter } from "vue-router";
import UApp from "@nuxt/ui/components/App.vue";
import ui from "@nuxt/ui/vue-plugin";
import { providePrototypeApiServices, resetPrototypeBackend } from "../api";
import { startPrototypeBackend } from "../mock-backend/browser";
import NotesPreview from "./NotesPreview.vue";
import { notesApi } from "./api";
import "../../src/style.css";

test.each([
  [390, 844],
  [1280, 800],
])("GM captures, edits and finds an entry at %i × %i", async (width, height) => {
  await page.viewport(width, height);
  await startPrototypeBackend();
  resetPrototypeBackend();

  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({
    render: () => h(UApp, null, { default: () => h(NotesPreview, { api: notesApi }) }),
  });
  providePrototypeApiServices(app);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: NotesPreview },
      { path: "/games/:gameId", component: NotesPreview },
      { path: "/games/:gameId/notes", component: NotesPreview },
      { path: "/games/:gameId/notes/new", component: NotesPreview },
    ],
  });
  app.use(router).use(ui).use(VueQueryPlugin, { queryClient: new QueryClient() });
  app.mount(root);

  try {
    const control = (id: string) => page.getByTestId(id);
    await expect.element(control("note-new")).not.toBeInTheDocument();
    const notesTab = control("edge-tab-notes");
    expect(notesTab.element().closest('[role="tablist"]')).toBeTruthy();
    const table = control("game-table").element();
    const tableUrl = location.href;
    await notesTab.click();
    await expect.element(control("notes-panel")).toBeVisible();
    const recentCard = control("recent-note-f34dd6ea-cdfe-4ee5-9cc8-39e5fc68a5c1");
    await expect.element(recentCard).toBeVisible();
    expect(recentCard.element().textContent).toContain("Mara will take the party across at dawn");
    expect(recentCard.element().querySelector("details")).toBeNull();
    const searchLink = control("notes-open-search").element();
    expect(searchLink.tagName).toBe("A");
    expect(getComputedStyle(searchLink).textDecorationLine).toBe("underline");
    const drawer = control("notes-panel").element().closest('[role="dialog"]')!;
    await expect.poll(() => Math.round(drawer.getBoundingClientRect().right)).toBe(width);
    expect(Math.round(drawer.getBoundingClientRect().height)).toBe(height);
    await expect.element(notesTab).toHaveAttribute("aria-pressed", "true");
    await expect.element(control("edge-tab-history")).not.toBeInTheDocument();
    expect(location.href).toBe(tableUrl);
    expect(control("game-table").element()).toBe(table);
    await expect.element(control("notes-search")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.element(control("notes-panel")).not.toBeInTheDocument();
    expect(control("game-table").element()).toBe(table);
    await expect.element(control("edge-tab-history")).toBeVisible();
    await notesTab.click();
    await recentCard.click();
    await expect.element(control("note-title")).toHaveValue("The ferryman’s price");
    await control("notes-back").click();
    await control("edge-tab-notes").click();
    await control("notes-open-search").click();
    await control("note-new").click();
    expect(router.currentRoute.value.path).toMatch(/\/notes\/new$/);
    await expect.element(control("notes-search")).not.toBeInTheDocument();
    await control("note-title").fill("Mirror lake");
    await control("note-cancel").click();
    await expect.element(control("notes-search")).toBeVisible();
    await control("note-new").click();
    await expect.element(control("note-title")).toHaveValue("Mirror lake");
    const maxBody = "🌊".repeat(5_000);
    await control("note-content").fill(maxBody + "x");
    await expect.poll(() => control("note-content").element().textContent === maxBody).toBe(true);
    await control("note-content").fill("The diver owes Mara a favor.");
    await userEvent.keyboard("{Control>}a{/Control}");
    await control("note-format-bold").click();
    await control("note-create").click();
    await expect.element(control("note-create")).not.toBeInTheDocument();
    expect(router.currentRoute.value.path).toMatch(/\/notes$/);
    await expect.element(control("notes-results")).toBeVisible();
    await control("notes-search").fill("DIVER");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    const entry = (await notesApi.list()).find((record) => record.title === "Mirror lake")!;
    expect(entry.content.ops).toContainEqual({
      insert: "The diver owes Mara a favor.",
      attributes: { bold: true },
    });
    expect(
      control("open-note-" + entry.id)
        .element()
        .closest("li")
        ?.querySelector("strong")?.textContent,
    ).toBe("The diver owes Mara a favor.");
    await control("open-note-" + entry.id).click();
    await control("note-content").fill("Meet at the salt tower.");
    await control("notes-results").click();
    await expect
      .poll(async () => (await notesApi.list()).find((record) => record.id === entry.id)?.revision)
      .toBe(2);
    await expect.element(control("open-note-" + entry.id)).not.toBeInTheDocument();
    await control("notes-search").fill("salt");
    await expect.element(control("open-note-" + entry.id)).toBeVisible();
    await control("notes-back").click();
    await expect.element(control("party-list")).toBeVisible();
  } finally {
    app.unmount();
    root.remove();
  }
});
