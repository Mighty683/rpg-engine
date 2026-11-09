import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import AttributeField from "./AttributeField.vue";
import "../../../../style.css";

test("selecting an attribute die updates its value", async () => {
  const value = ref("8");
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({
    render: () =>
      h(UApp, null, {
        default: () =>
          h(AttributeField, {
            label: "WLP",
            help: "Willpower",
            modelValue: value.value,
            "onUpdate:modelValue": (next: string) => {
              value.value = next;
            },
          }),
      }),
  }).use(ui);
  app.mount(root);
  try {
    await page.getByTestId("attribute-die-WLP").click();
    await page.getByTestId("attribute-die-option-12").click();
    await expect.element(page.getByTestId("attribute-die-WLP")).toHaveTextContent("d12");
    expect(value.value).toBe("12");
  } finally {
    app.unmount();
    root.remove();
  }
});
