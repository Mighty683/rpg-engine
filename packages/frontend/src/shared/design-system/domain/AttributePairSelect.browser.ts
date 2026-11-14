import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import AttributePairSelect from "./AttributePairSelect.vue";
import type { AttributeChoice } from "./types";
import "../../../style.css";

test("attribute pair supports incomplete weapons and repeated attributes without mutating its input", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const attributes: [AttributeChoice, AttributeChoice] = ["DEX", ""];
  const disabled = ref(false);
  const change = vi.fn();
  const app = createApp({
    render: () =>
      h(AttributePairSelect, {
        attributes,
        allowEmpty: true,
        disabled: disabled.value,
        testIds: ["first", "second"],
        onChange: change,
      }),
  }).use(ui);
  app.mount(root);
  try {
    await page.getByTestId("second").click();
    await page.getByTestId("second-option-DEX").click();
    expect(change).toHaveBeenCalledExactlyOnceWith(1, "DEX");
    expect(attributes).toEqual(["DEX", ""]);
    await page.getByTestId("first").click();
    await page.getByTestId("first-option-unselected").click();
    expect(change).toHaveBeenLastCalledWith(0, "");
    expect(attributes).toEqual(["DEX", ""]);
    disabled.value = true;
    await expect.element(page.getByTestId("first")).toBeDisabled();
    await expect.element(page.getByTestId("second")).toBeDisabled();
  } finally {
    app.unmount();
    root.remove();
  }
});
