import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import LabeledInput from "./LabeledInput.vue";
import "../../../style.css";

for (const multiline of [false, true]) {
  test(`shared ${multiline ? "textarea" : "input"} forwards changing state and preserves edits`, async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const value = ref("Initial");
    const pending = ref(false);
    const app = createApp(
      defineComponent({
        setup: () => () =>
          h(LabeledInput, {
            label: "Name",
            multiline,
            modelValue: value.value,
            "onUpdate:modelValue": (next: string | number | undefined) => {
              value.value = String(next);
            },
            disabled: pending.value,
            placeholder: pending.value ? "Saving…" : "Enter name",
            "data-testid": "shared-input",
          }),
      }),
    ).use(ui);
    app.mount(root);
    try {
      const input = page.getByTestId("shared-input");
      await input.fill("Edited");
      expect(value.value).toBe("Edited");
      pending.value = true;
      await expect.element(input).toBeDisabled();
      await expect.element(input).toHaveAttribute("placeholder", "Saving…");
      await expect.element(input).toHaveValue("Edited");
      pending.value = false;
      await expect.element(input).toBeEnabled();
      await input.fill("Retry");
      expect(value.value).toBe("Retry");
    } finally {
      app.unmount();
      root.remove();
    }
  });
}
