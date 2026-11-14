import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import LabeledSelect from "./LabeledSelect.vue";
import "../../../style.css";

test("select forwards options, edits, disabled state and exposed focus", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const value = ref("a");
  const disabled = ref(false);
  const control = ref<{ triggerRef?: HTMLElement }>();
  const app = createApp({
    render: () =>
      h(
        LabeledSelect,
        {
          ref: control,
          label: "Character",
          modelValue: value.value,
          items: [
            { label: "Rowan", value: "a" },
            { label: "Nera", value: "b" },
          ],
          disabled: disabled.value,
          "data-testid": "character-select",
          "onUpdate:modelValue": (next: string | number | undefined) => {
            value.value = String(next);
          },
        },
        {
          "item-label": ({ item }: { item: { value: string; label: string } }) =>
            h("span", { "data-testid": `choice-${item.value}` }, item.label),
        },
      ),
  }).use(ui);
  app.mount(root);
  try {
    const select = page.getByTestId("character-select");
    await select.click();
    await page.getByTestId("choice-b").click();
    expect(value.value).toBe("b");
    disabled.value = true;
    await expect.element(select).toBeDisabled();
    disabled.value = false;
    await expect.element(select).toBeEnabled();
    control.value?.triggerRef?.focus();
    await expect.element(select).toHaveFocus();
    await expect.element(select).toHaveTextContent("Nera");
  } finally {
    app.unmount();
    root.remove();
  }
});
