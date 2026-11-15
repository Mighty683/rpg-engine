import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { http, HttpResponse } from "msw";
import { createApp, defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import UApp from "@nuxt/ui/components/App.vue";
import ui from "@nuxt/ui/vue-plugin";
import { createFrontendI18n } from "../../src/shared/i18n";
import { startPrototypeBackend, prototypeWorker } from "../mock-backend/browser";
import { resetPrototypeBackend, setPrototypeScenario, prototypeStore } from "../mock-backend/store";
import ProgressionPrototype from "./ProgressionPrototype.vue";
import "../../src/style.css";

let cleanup = () => {};
beforeAll(() => startPrototypeBackend());
afterAll(() => prototypeWorker.stop());
beforeEach(() => resetPrototypeBackend());
afterEach(() => {
  cleanup();
  prototypeWorker.resetHandlers();
});
function mount(readOnly = false) {
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup: () => () => h(UApp, {}, { default: () => h(ProgressionPrototype, { readOnly }) }),
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

const meter = (id: string) => page.getByTestId(id).getByTestId("progress-meter");
const increase = (id: string) => page.getByTestId(id).getByTestId("increase-progress").click();
const decrease = (id: string) => page.getByTestId(id).getByTestId("decrease-progress").click();
async function addClass(id: string) {
  await page.getByTestId("add-class").click();
  await page.getByTestId(`choose-class-${id}`).click();
  await page.getByTestId(`class-summary-${id}`).click();
}
async function addSkill(classId: string, skillId: string) {
  await page.getByTestId(`add-skill-${classId}`).click();
  await page.getByTestId(`select-skill-${skillId}`).click();
}
test("optimistic edits queue during slow saves and update table maxima before acknowledgement", async () => {
  mount();
  await page.getByTestId("class-summary-guardian").click();
  setPrototypeScenario("loading");
  await increase("class-progress-guardian");
  await increase("skill-progress-resolve");
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "3");
  expect(prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(2);
  await increase("class-progress-guardian");
  await increase("skill-progress-resolve");
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "4");
  await page.getByTestId("surface-table").click();
  await expect
    .element(page.getByTestId("table-classes-catalog-rowan"))
    .toHaveTextContent("ClassesGuardian 5 · Scholar 2");
  await expect.element(page.getByTestId("party-hp").first()).toHaveTextContent("28 / 70");
  await expect
    .poll(() => prototypeStore.progressionRanks["catalog-rowan"]?.resolve, { timeout: 6000 })
    .toBe(4);
  setPrototypeScenario("default");
  await page.getByTestId("surface-sheet").click();
  await page.getByTestId("reload-progression").click();
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "4");
  await page.getByTestId("class-summary-guardian").click();
  await decrease("skill-progress-resolve");
  await decrease("class-progress-guardian");
  await expect.poll(() => prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(3);
});
test("failed class save retains the existing toast recovery without a manual save form", async () => {
  mount();
  await page.getByTestId("class-summary-guardian").click();
  setPrototypeScenario("error");
  await increase("class-progress-guardian");
  await expect.element(page.getByTestId("refresh-progression-error").first()).toBeVisible();
  await expect.element(meter("class-progress-guardian")).toHaveAttribute("aria-valuenow", "4");
  expect(prototypeStore.progressionLevels["catalog-rowan"]?.guardian).toBe(3);
  await expect.element(page.getByTestId("retry-inline-save")).not.toBeInTheDocument();
  setPrototypeScenario("default");
  await page.getByTestId("refresh-progression-error").first().click();
  await expect.element(meter("class-progress-guardian")).toHaveAttribute("aria-valuenow", "3");
});
test("confirmed rejection rolls ranks and derived stats back without a save form", async () => {
  mount();
  await page.getByTestId("class-summary-guardian").click();
  await increase("class-progress-guardian");
  await expect.poll(() => prototypeStore.progressionLevels["catalog-rowan"]?.guardian).toBe(4);
  prototypeWorker.use(
    http.post(
      "*/api/prototype/class-progression/:id",
      () => HttpResponse.json({ error: { message: "Rank rejected" } }, { status: 400 }),
      { once: true },
    ),
  );
  await increase("skill-progress-resolve");
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "2");
  expect(prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(2);
  await page.getByTestId("surface-table").click();
  await expect.element(page.getByTestId("party-hp").first()).toHaveTextContent("28 / 65");
});
test("new character selects classes and skills inline without blocking record navigation", async () => {
  mount();
  await page.getByTestId("progression-character").click();
  await page.getByTestId("select-catalog-new").click();
  await addClass("guardian");
  await increase("class-progress-guardian");
  await increase("class-progress-guardian");
  await addSkill("guardian", "resolve");
  await increase("skill-progress-resolve");
  await increase("skill-progress-resolve");
  await page.getByTestId("progression-character").click();
  await page.getByTestId("select-catalog-rowan").click();
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "2");
  await page.getByTestId("progression-character").click();
  await page.getByTestId("select-catalog-new").click();
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "3");
  await addClass("scholar");
  await increase("class-progress-scholar");
  await addSkill("scholar", "insight");
  await increase("skill-progress-insight");
  await expect
    .poll(() => prototypeStore.progressionRanks["catalog-new"])
    .toEqual({ resolve: 3, insight: 2 });
  expect(prototypeStore.progressionRanks["catalog-rowan"]).toEqual({
    resolve: 2,
    cover: 1,
    insight: 2,
  });
});
test("skill picker inside table sheet drawer saves to the shared table projection", async () => {
  mount();
  await page.getByTestId("surface-table").click();
  await page.getByTestId("open-sheet-catalog-rowan").click();
  await page.getByTestId("class-summary-scholar").click();
  await increase("class-progress-scholar");
  await addSkill("scholar", "study");
  await expect.poll(() => prototypeStore.progressionRanks["catalog-rowan"]?.study).toBe(1);
  await page.getByTestId("close-character-sheets").click();
  await expect
    .element(page.getByTestId("table-classes-catalog-rowan"))
    .toHaveTextContent("ClassesGuardian 3 · Scholar 3");
});
test("read-only review keeps skill descriptions accessible without progression controls", async () => {
  mount(true);
  await expect.element(page.getByTestId("class-summary-guardian")).toBeVisible();
  await expect.element(page.getByTestId("acquired-resolve")).not.toBeVisible();
  await page.getByTestId("class-summary-guardian").click();
  await expect.element(page.getByTestId("acquired-resolve")).toBeVisible();
  expect(
    document.querySelector('[data-testid="class-benefits-guardian"]')?.textContent,
  ).not.toContain("Resilience");
  await expect.element(page.getByTestId("increase-progress")).not.toBeInTheDocument();
  await page.getByTestId("surface-table").click();
  await page.getByTestId("open-sheet-catalog-rowan").click();
  await expect.element(page.getByTestId("sheet-abilities")).toBeVisible();
  await expect.element(page.getByTestId("increase-progress")).not.toBeInTheDocument();
});

test("failed loads recover and empty rosters remain distinct", async () => {
  setPrototypeScenario("error");
  mount();
  await expect.element(page.getByTestId("retry-progression")).toBeVisible();
  await expect.element(page.getByTestId("progression-empty")).not.toBeInTheDocument();
  setPrototypeScenario("empty");
  await page.getByTestId("retry-progression").click();
  await expect.element(page.getByTestId("progression-empty")).toBeVisible();
  await page.getByTestId("reset-progression").click();
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "2");
});

test("table uses one class card before weapons, with hover preview and click details", async () => {
  mount();
  await page.getByTestId("surface-table").click();
  const card = page.getByTestId("table-classes-catalog-rowan");
  await expect.element(card).toBeVisible();
  await expect.element(page.getByTestId("acquired-resolve")).not.toBeInTheDocument();
  const trigger = document.querySelector('[data-testid="table-classes-catalog-rowan"]')!;
  const weapons = trigger
    .closest('[data-testid="party-card"]')!
    .querySelector('[data-testid="party-weapons"]')!;
  expect(trigger.compareDocumentPosition(weapons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await card.hover();
  await expect.element(page.getByTestId("class-preview-catalog-rowan")).toBeVisible();
  await card.click();
  await expect.element(page.getByTestId("acquired-resolve")).toBeVisible();
  await expect.element(meter("skill-progress-resolve")).toHaveAttribute("aria-valuenow", "2");
});

test("class details show free-benefit pills before skill cards", async () => {
  mount();
  await page.getByTestId("surface-table").click();
  await page.getByTestId("table-classes-catalog-rowan").click();
  await expect.element(page.getByTestId("class-benefits-guardian")).toBeVisible();
  await expect.element(page.getByTestId("class-skills-guardian")).toBeVisible();
  const card = document.querySelector('[data-testid="class-card-guardian"]')!;
  expect(card.tagName).toBe("ARTICLE");
  expect(card.querySelectorAll("details, summary")).toHaveLength(0);
  const benefits = card.querySelector('[data-testid="class-benefits-guardian"]')!;
  const skills = card.querySelector('[data-testid="class-skills-guardian"]')!;
  expect(benefits.compareDocumentPosition(skills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("benefits show effects without duplicating skill rank bars", async () => {
  await page.viewport(1200, 900);
  mount();
  await page.getByTestId("surface-table").click();
  await page.getByTestId("table-classes-catalog-rowan").click();
  await expect.element(page.getByTestId("class-benefits-guardian")).toBeVisible();
  const benefits = document.querySelector('[data-testid="class-benefits-guardian"]')!;
  expect(benefits.textContent).not.toContain("Applied");
  expect(benefits.textContent).not.toContain("Resulting maximum");
  expect(benefits.textContent).not.toContain("once on acquiring");
  expect(benefits.textContent).not.toContain("Guardian · Free benefit");
  expect(benefits.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  await expect
    .element(page.getByTestId("skill-progress-resolve").getByTestId("progress-meter"))
    .toHaveAttribute("aria-valuenow", "2");
  expect(benefits.textContent).not.toContain("Resilience");
  expect(benefits.textContent).not.toContain("Protect an ally");
  expect(benefits.querySelectorAll("li")).toHaveLength(1);
  expect(benefits.querySelectorAll("h4")).toHaveLength(0);
  expect(benefits.querySelector("li")!.getBoundingClientRect().width).toBeLessThan(
    benefits.getBoundingClientRect().width / 2,
  );
  for (const sectionId of ["class-skills-guardian"]) {
    const cards = document.querySelectorAll(`[data-testid="${sectionId}"] li`);
    expect(cards[0]!.getBoundingClientRect().top).toBe(cards[1]!.getBoundingClientRect().top);
    expect(cards[1]!.getBoundingClientRect().left).toBeGreaterThan(
      cards[0]!.getBoundingClientRect().left,
    );
  }
});

test("add class card opens class selection and adds a class without a separate form", async () => {
  mount();
  await page.getByTestId("add-class").click();
  await expect.element(page.getByTestId("choose-class-artisan")).toBeVisible();
  await page.getByTestId("preview-class-artisan").click();
  expect(document.querySelector('[data-testid="preview-class-artisan"]')?.textContent).toContain(
    "Craft",
  );
  expect(prototypeStore.progressionLevels["catalog-rowan"]?.artisan ?? 0).toBe(0);
  await page.getByTestId("choose-class-artisan").click();
  await expect.element(page.getByTestId("class-summary-artisan")).toBeVisible();
  await expect.element(page.getByTestId("choose-class-artisan")).not.toBeInTheDocument();
  await expect
    .element(page.getByTestId("class-progress-artisan").getByTestId("progress-meter"))
    .toHaveAttribute("aria-valuenow", "1");
  await expect.element(page.getByTestId("add-class")).toBeEnabled();
  expect(prototypeStore.progressionRanks["catalog-rowan"]).toEqual({
    resolve: 2,
    cover: 1,
    insight: 2,
  });
  await expect.element(page.getByTestId("inline-status")).not.toBeInTheDocument();
  await expect.element(page.getByTestId("retry-inline-save")).not.toBeInTheDocument();
  await expect.poll(() => prototypeStore.progressionLevels["catalog-rowan"]?.artisan).toBe(1);
  await page.getByTestId("surface-table").click();
  await expect
    .element(page.getByTestId("table-classes-catalog-rowan"))
    .toHaveTextContent("ClassesGuardian 3 · Scholar 2 · Artisan 1");
  await page.getByTestId("surface-sheet").click();
  await page.getByTestId("reload-progression").click();
  await expect.element(meter("class-progress-artisan")).toHaveAttribute("aria-valuenow", "1");
  await decrease("class-progress-artisan");
  await expect.element(page.getByTestId("class-summary-artisan")).not.toBeInTheDocument();
});

test("class and skill controls explain why they are disabled", async () => {
  mount();
  await expect.element(page.getByTestId("class-summary-guardian")).toBeVisible();
  await expect.element(page.getByTestId("sheet-editability")).not.toBeInTheDocument();
  await page.getByTestId("class-summary-guardian").click();
  const classDecrease = page
    .getByTestId("class-progress-guardian")
    .getByTestId("decrease-progress-trigger");
  const skillIncrease = page
    .getByTestId("skill-progress-resolve")
    .getByTestId("increase-progress-trigger");
  await classDecrease.hover();
  await expect
    .element(page.getByTestId("decrease-progress-tooltip").first())
    .toHaveTextContent("Lower a skill rank in this class before lowering its level.");
  await skillIncrease.hover();
  await expect
    .element(page.getByTestId("increase-progress-tooltip").first())
    .toHaveTextContent("Increase the class level or lower another skill rank to free up a rank.");
  await increase("class-progress-guardian");
  await expect.element(skillIncrease.getByTestId("increase-progress")).toBeEnabled();
  await increase("skill-progress-resolve");
  await increase("class-progress-guardian");
  await increase("skill-progress-resolve");
  await increase("class-progress-guardian");
  await increase("skill-progress-resolve");
  await skillIncrease.hover();
  await expect
    .element(page.getByTestId("increase-progress-tooltip").first())
    .toHaveTextContent("Maximum rank reached.");
  await expect
    .element(page.getByTestId("skill-progress-resolve").getByTestId("increase-progress"))
    .toBeDisabled();
  await expect.poll(() => prototypeStore.progressionRanks["catalog-rowan"]?.resolve).toBe(5);
});

test("a descriptive free-benefit pill opens its full effect without a skill purchase", async () => {
  await page.viewport(390, 844);
  mount();
  await addClass("wayfarer");
  await page.getByTestId("free-benefit-travel").click();
  await expect
    .element(page.getByTestId("free-benefit-description-travel"))
    .toHaveTextContent("Identify a safe campsite and a source of drinking water while traveling.");
  await expect.poll(() => prototypeStore.progressionLevels["catalog-rowan"]?.wayfarer).toBe(1);
  expect(prototypeStore.progressionRanks["catalog-rowan"]?.trail).toBeUndefined();
  await page.viewport(1200, 900);
});
