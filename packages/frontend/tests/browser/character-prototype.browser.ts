import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import ui from "@nuxt/ui/vue-plugin";
import PrototypeGallery from "../../prototypes/PrototypeGallery.vue";
import "../../src/style.css";

async function mountGallery() {
  const root = document.createElement("div");
  document.body.append(root);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: PrototypeGallery }] });
  await router.push("/");
  const app = createApp(PrototypeGallery).use(router).use(ui);
  app.mount(root);
  await nextTick();
  return () => { app.unmount(); root.remove(); };
}

test("removal requires confirmation and editing lock prevents changes", async () => {
  const cleanup = await mountGallery();
  try {
    await page.getByTestId("remove-rapier").click();
    await expect.element(page.getByTestId("cancel-remove")).toBeVisible();
    await page.getByTestId("cancel-remove").click();
    await expect.element(page.getByTestId("remove-rapier")).toBeVisible();
    await page.getByTestId("remove-rapier").click();
    await page.getByTestId("confirm-remove").click();
    await expect.element(page.getByTestId("remove-rapier")).not.toBeInTheDocument();
    await page.getByTestId("toggle-editing-lock").click();
    await expect.element(page.getByTestId("defense-DEF")).toBeDisabled();
    await expect.element(page.getByTestId("remove-orator")).toBeDisabled();
    await page.getByTestId("defense-card-DEF").click();
    await expect.element(page.getByText("Unlock editing to make changes.")).toBeVisible();
    await page.getByTestId("toggle-editing-lock").click();
    await expect.element(page.getByTestId("defense-DEF")).toBeEnabled();
  } finally { cleanup(); }
});

test("equipped armor and shield update defenses while manual overrides remain reversible", async () => {
  const cleanup = await mountGallery();
  try {
    await expect.element(page.getByTestId("defense-DEF")).toHaveValue(11);
    await expect.element(page.getByTestId("defense-MAG DEF")).toHaveValue(13);
    await expect.element(page.getByTestId("defense-INIT")).toHaveValue(-1);
    await page.getByTestId("defense-DEF").fill("20");
    await expect.element(page.getByTestId("defense-DEF")).toHaveValue(20);
    await page.getByTestId("restore-DEF").click();
    await expect.element(page.getByTestId("defense-DEF")).toHaveValue(11);
  } finally { cleanup(); }
});
