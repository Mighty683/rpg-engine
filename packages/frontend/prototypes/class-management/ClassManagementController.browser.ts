import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import ClassManagementController from "./ClassManagementController.vue";
import "../../src/style.css";

let cleanup = () => {};
afterEach(() => cleanup());

test("free benefit drafts support both kinds, removal, and screen changes", async () => {
  const screen = ref("Create");
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup: () => () => h(ClassManagementController, { screen: screen.value, context: "Library" }),
    }),
  ).use(ui);
  app.mount(root);
  cleanup = () => {
    app.unmount();
    root.remove();
  };

  await page.getByTestId("new-benefit-name").fill("New benefit");
  await page.getByTestId("add-benefit").click();
  await page.getByTestId("benefit-description-3").fill("Guard an ally");
  await page.getByTestId("new-benefit-name").fill("New benefit");
  await page.getByTestId("add-benefit").click();
  await page.getByTestId("benefit-kind-4").click();
  await page.getByTestId("benefit-kind-option-modifier").click();
  await page.getByTestId("benefit-stat-4").click();
  await page.getByTestId("benefit-stat-option-dieDex").click();
  await page.getByTestId("benefit-amount-4").fill("5");
  await nextTick();
  screen.value = "List";
  await expect.element(page.getByTestId("benefit-3")).not.toBeInTheDocument();
  screen.value = "Create";
  await expect.element(page.getByTestId("benefit-description-3")).toHaveValue("Guard an ally");
  await expect.element(page.getByTestId("benefit-stat-4")).toHaveTextContent("DEX die");
  await expect.element(page.getByTestId("benefit-amount-4")).toHaveValue(5);
  await page.getByTestId("remove-benefit-3").click();
  await expect.element(page.getByTestId("benefit-3")).not.toBeInTheDocument();
  await expect.element(page.getByTestId("benefit-4")).toBeVisible();
});

test("opening a class edits its details and benefits in place", async () => {
  const screen = ref("List");
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(ClassManagementController, {
          screen: screen.value,
          context: "Library",
          onNavigate: (value: string) => {
            screen.value = value;
          },
        }),
    }),
  ).use(ui);
  app.mount(root);
  cleanup = () => {
    app.unmount();
    root.remove();
  };
  await page.getByTestId("view-class").click();
  await expect.element(page.getByTestId("class-name")).toHaveValue("Guardian");
  const input = root.querySelector<HTMLInputElement>('[data-testid="class-name"]')!;
  expect(input.labels?.[0]?.textContent).toContain("Name");
  await page.getByTestId("class-name").fill("Warden");
  await page.getByTestId("benefit-name-1").fill("Toughness");
  await page.getByTestId("benefit-description-1").fill("Extra resilience");
  await page.getByTestId("benefit-amount-1").fill("7");
  screen.value = "List";
  await page.getByTestId("view-class").click();
  await expect.element(page.getByTestId("class-name")).toHaveValue("Warden");
  await expect.element(page.getByTestId("benefit-amount-1")).toHaveValue(7);
  await expect.element(page.getByTestId("benefit-name-1")).toHaveValue("Toughness");
  await expect.element(page.getByTestId("benefit-description-1")).toHaveValue("Extra resilience");
});
