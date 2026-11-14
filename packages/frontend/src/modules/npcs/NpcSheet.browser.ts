import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import NpcSheet from "./NpcSheet.vue";
import type { Npc } from "./types";
import "../../style.css";

test("NPC removal requires confirmation and prevents another action while pending", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const npc: Npc = {
    id: "npc-confirmation",
    name: "Ash Wolf",
    level: 10,
    baseDice: { DEX: 10, INS: 8, MIG: 10, WLP: 6 },
    hp: { current: 35, max: 50 },
    mp: { current: 15, max: 30 },
    crisis: 25,
    defense: 10,
    magicDefense: 8,
    initiative: 10,
    attacks: [],
    abilities: [],
    vulnerabilities: [],
    resistances: [],
    immunities: [],
    statusImmunities: [],
    tags: [],
    notes: "",
  };
  const pending = ref(false);
  const remove = vi.fn(() => {
    pending.value = true;
  });
  const app = createApp({
    render: () =>
      h(UApp, null, {
        default: () =>
          h(NpcSheet, { npc: structuredClone(npc), pending: pending.value, onRemove: remove }),
      }),
  }).use(ui);
  app.mount(root);
  try {
    await page.getByTestId("remove-npc").click();
    await page.getByTestId("cancel-remove-npc").click();
    expect(remove).not.toHaveBeenCalled();
    await page.getByTestId("remove-npc").click();
    await page.getByTestId("confirm-remove-npc").click();
    expect(remove).toHaveBeenCalledExactlyOnceWith(npc.id);
    await expect.element(page.getByTestId("confirm-remove-npc")).toBeDisabled();
    await expect.element(page.getByTestId("cancel-remove-npc")).toBeDisabled();
    await expect.element(page.getByTestId("npc-name")).toBeDisabled();
    pending.value = false;
    await expect.element(page.getByTestId("cancel-remove-npc")).toBeEnabled();
    await page.getByTestId("cancel-remove-npc").click();
  } finally {
    app.unmount();
    root.remove();
  }
});
