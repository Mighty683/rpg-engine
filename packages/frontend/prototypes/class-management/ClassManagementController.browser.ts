import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import UApp from "@nuxt/ui/components/App.vue";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../src/shared/i18n";
import { prototypeWorker, startPrototypeBackend } from "../mock-backend/browser";
import { prototypeStore, resetPrototypeBackend, setPrototypeScenario } from "../mock-backend/store";
import ClassManagementPrototype from "./ClassManagementPrototype.vue";
import "../../src/style.css";

let cleanup = () => {};
beforeAll(() => startPrototypeBackend());
afterAll(() => prototypeWorker.stop());
beforeEach(() => resetPrototypeBackend());
afterEach(() => cleanup());

function mount(contextName = "Library") {
  const screen = ref("List");
  const context = ref(contextName);
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup: () => () =>
        h(
          UApp,
          {},
          {
            default: () =>
              h(ClassManagementPrototype, {
                screen: screen.value,
                context: context.value,
                onNavigate: (value: string) => {
                  screen.value = value;
                },
                onSwitchContext: (value: string) => {
                  context.value = value;
                  screen.value = "List";
                },
              }),
          },
        ),
    }),
  )
    .use(ui)
    .use(
      createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/", component: { template: "<div />" } }],
      }),
    )
    .use(createFrontendI18n());
  app.mount(root);
  cleanup = () => {
    app.unmount();
    root.remove();
  };
}

async function createClass(name: string) {
  await page.getByTestId("create-class").click();
  await page.getByTestId("create-class-name").fill(name);
  await page.getByTestId("add-library-class").click();
}

test("library creation is optimistic and the copied class can be acquired without a skill", async () => {
  mount();
  await expect.element(page.getByTestId("empty-class-list")).toBeVisible();
  setPrototypeScenario("loading");
  await createClass("Lancer");
  await expect.element(page.getByTestId("class-name")).toHaveValue("Lancer");
  expect(prototypeStore.libraryClasses).toHaveLength(0);
  setPrototypeScenario("default");
  await page.getByTestId("class-description").fill("Controls the front line.");
  await expect
    .poll(() => prototypeStore.libraryClasses[0]?.description, { timeout: 6000 })
    .toBe("Controls the front line.");
  const libraryId = prototypeStore.libraryClasses[0]!.id;

  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("switch-class-context").click();
  await expect.element(page.getByTestId("create-class")).not.toBeInTheDocument();
  await page.getByTestId("copy-from-library").click();
  setPrototypeScenario("loading");
  await page.getByTestId(`copy-class-${libraryId}`).click();
  await expect.element(page.getByTestId("class-name")).toHaveValue("Lancer");
  await expect.element(page.getByTestId("class-name")).toHaveAttribute("readonly");
  await expect
    .poll(() => prototypeStore.gameClasses.find((entry) => entry.name === "Lancer")?.id, {
      timeout: 4000,
    })
    .toBeTruthy();
  setPrototypeScenario("default");
  await expect.element(page.getByTestId("class-name")).not.toHaveAttribute("readonly");
  const copyId = prototypeStore.gameClasses.find((entry) => entry.name === "Lancer")!.id;
  expect(copyId).not.toBe(libraryId);
  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("view-characters").click();
  await page.getByTestId("add-class").click();
  await page.getByTestId(`choose-class-${copyId}`).click();
  await expect.element(page.getByTestId(`class-summary-${copyId}`)).toBeVisible();
  await expect.poll(() => prototypeStore.progressionLevels["catalog-rowan"]?.[copyId]).toBe(1);
  expect(prototypeStore.progressionRanks["catalog-rowan"]).toEqual({
    resolve: 2,
    cover: 1,
    insight: 2,
  });
});

test("a character can acquire five classes before mastering any", async () => {
  prototypeStore.gameClasses.push(
    { id: "lancer", name: "Lancer", description: "", benefits: [], skills: [] },
    { id: "scout", name: "Scout", description: "", benefits: [], skills: [] },
  );
  mount("Game");
  await page.getByTestId("view-characters").click();
  for (const id of ["wayfarer", "artisan", "lancer"]) {
    await page.getByTestId("add-class").click();
    await page.getByTestId(`choose-class-${id}`).click();
    await expect.poll(() => prototypeStore.progressionLevels["catalog-rowan"]?.[id]).toBe(1);
  }
  await expect.element(page.getByTestId("add-class")).toBeDisabled();
  await expect
    .element(page.getByTestId("add-class-trigger"))
    .toHaveAttribute("aria-label", "A character can have up to 5 classes.");
});

test("library edits preserve an independent game copy until it is removed and copied again", async () => {
  mount();
  await createClass("Lancer");
  await expect.poll(() => prototypeStore.libraryClasses[0]?.name).toBe("Lancer");
  const libraryId = prototypeStore.libraryClasses[0]!.id;

  await page.getByTestId("class-tab-benefits").click();
  await page.getByTestId("new-benefit-name").fill("Vigor");
  await page.getByTestId("add-benefit").click();
  const draftBenefit = () =>
    document.querySelector<HTMLInputElement>('[data-testid^="benefit-description-"]')?.dataset
      .testid;
  await expect.poll(draftBenefit).toBeTruthy();
  expect(prototypeStore.libraryClasses[0]?.benefits).toEqual([]);
  await page.getByTestId(draftBenefit()!).fill("Recover your footing after a fall.");
  await expect.poll(() => prototypeStore.libraryClasses[0]?.benefits.length).toBe(1);
  await page.getByTestId("class-tab-skills").click();
  await page.getByTestId("add-skill").click();
  const draftSkill = () =>
    document.querySelector<HTMLInputElement>('[data-testid^="skill-name-"]')?.dataset.testid;
  await expect.poll(draftSkill).toBeTruthy();
  expect(prototypeStore.libraryClasses[0]?.skills).toEqual([]);
  await page.getByTestId(draftSkill()!).fill("Lunge");
  await expect.poll(() => prototypeStore.libraryClasses[0]?.skills.length).toBe(1);
  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("switch-class-context").click();
  await page.getByTestId("copy-from-library").click();
  await page.getByTestId(`copy-class-${libraryId}`).click();
  await expect
    .poll(
      () => prototypeStore.gameClasses.find((entry) => entry.name === "Lancer")?.skills[0]?.name,
    )
    .toBe("Lunge");
  const copy = prototypeStore.gameClasses.find((entry) => entry.name === "Lancer")!;
  expect(copy.benefits[0]?.description).toBe("Recover your footing after a fall.");
  expect(copy.skills[0]?.id).not.toBe(prototypeStore.libraryClasses[0]!.skills[0]!.id);
  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("copy-from-library").click();
  await page.getByTestId("switch-class-context").click();
  await page.getByTestId(`view-class-${libraryId}`).click();
  await page.getByTestId("class-name").fill("Cavalier");
  await expect.poll(() => prototypeStore.libraryClasses[0]?.name).toBe("Cavalier");
  expect(prototypeStore.gameClasses.find(({ id }) => id === copy.id)?.name).toBe("Lancer");
  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("switch-class-context").click();
  await page.getByTestId(`remove-class-${copy.id}`).click();
  await expect.element(page.getByTestId(`view-class-${copy.id}`)).not.toBeInTheDocument();
  await page.getByTestId("copy-from-library").click();
  await page.getByTestId(`copy-class-${libraryId}`).click();
  await expect.element(page.getByTestId("class-name")).toHaveValue("Cavalier");
  await expect
    .poll(() => prototypeStore.gameClasses.find((entry) => entry.name === "Cavalier")?.id)
    .toBeTruthy();
});

test("removing an in-use game skill names its users and requires confirmation", async () => {
  mount("Game");
  await page.getByTestId("view-class-guardian").click();
  await page.getByTestId("class-tab-skills").click();
  await page.getByTestId("remove-skill-resolve").click();
  await expect
    .element(page.getByTestId("affected-skill-users"))
    .toHaveTextContent("Rowan Ash · Rank 2");
  expect(prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(2);
  await page.getByTestId("cancel-skill-removal").click();
  await expect.element(page.getByTestId("skill-resolve")).toBeVisible();
  await page.getByTestId("remove-skill-resolve").click();
  await page.getByTestId("confirm-skill-removal").click();
  await expect.element(page.getByTestId("skill-resolve")).not.toBeInTheDocument();
  await expect
    .poll(() => prototypeStore.progressionRanks["catalog-rowan"]?.resolve)
    .toBeUndefined();
  expect(prototypeStore.progressionLevels["catalog-rowan"]?.guardian).toBe(3);
  await page.getByTestId("back-to-classes").click();
  await page.getByTestId("view-characters").click();
  await page.getByTestId("class-summary-guardian").click();
  await expect.element(page.getByTestId("acquired-resolve")).not.toBeInTheDocument();
  await expect.element(page.getByTestId("acquired-cover")).toBeVisible();
});

test("saving an in-use game class offers new and existing template choices", async () => {
  mount("Game");
  const save = page.getByTestId("save-to-library-guardian");
  await save.click();
  await expect.element(page.getByTestId("library-save-name")).toHaveValue("Guardian");
  await page.getByTestId("library-save-name").fill("Saved Guardian");
  await page.getByTestId("confirm-save-to-library").click();
  await expect.poll(() => prototypeStore.libraryClasses[0]?.name).toBe("Saved Guardian");
  const template = prototypeStore.libraryClasses[0]!;
  await save.click();
  await page.getByTestId("library-save-mode").click();
  await page.getByTestId("library-save-update").click();
  await page.getByTestId("library-save-template").click();
  await page.getByTestId(`library-template-${template.id}`).click();
  await page.getByTestId("confirm-save-to-library").click();
  await expect.poll(() => prototypeStore.libraryClasses[0]?.name).toBe("Guardian");
  expect(prototypeStore.libraryClasses.map(({ id }) => id)).toEqual([template.id]);
  expect(prototypeStore.progressionLevels["catalog-rowan"]?.guardian).toBe(3);
  expect(prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(2);
  await expect.element(save).toBeVisible();
});
