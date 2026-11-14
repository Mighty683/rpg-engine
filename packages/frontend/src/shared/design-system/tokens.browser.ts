import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UButton from "@nuxt/ui/components/Button.vue";
import LabeledInput from "./base/LabeledInput.vue";
import ResourceBar from "./domain/ResourceBar.vue";
import "../../style.css";

test("fixed palette and Nuxt control aliases remain consistent across color-mode classes", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const html = document.documentElement;
  const originalClass = html.className;
  const originalStyle = html.style.cssText;
  const app = createApp({
    render: () =>
      h("div", null, [
        h(UButton, { "data-testid": "token-button" }, () => "Save"),
        h(LabeledInput, { label: "Name", "data-testid": "token-input" }),
        h(ResourceBar, {
          label: "HP",
          value: 10,
          maximum: 20,
          color: "hp",
          "data-testid": "token-resource",
        }),
      ]),
  }).use(ui);
  app.mount(root);
  try {
    const button = page.getByTestId("token-button");
    await expect.element(button).toBeVisible();
    for (const mode of ["light", "dark"]) {
      html.classList.remove("light", "dark");
      html.classList.add(mode);
      const style = getComputedStyle(button.element());
      expect(style.color).toBe("rgb(15, 23, 42)");
      expect(style.backgroundColor).toBe("rgb(74, 222, 128)");
      expect(style.borderRadius).toBe("6px");
      expect(style.fontSize).toBe("14px");
    }
    button.element().focus();
    expect(getComputedStyle(button.element()).outlineWidth).toBe("2px");
    expect(getComputedStyle(button.element()).outlineOffset).toBe("2px");
    await expect
      .poll(() => getComputedStyle(button.element()).outlineColor)
      .toBe("rgb(74, 222, 128)");

    // Override the token source to verify rendered adapters, not literal CSS text.
    html.style.setProperty("--radius-control", "12px");
    html.style.setProperty("--text-small", "18px");
    expect(getComputedStyle(button.element()).borderRadius).toBe("12px");
    expect(getComputedStyle(page.getByTestId("token-input").element()).borderRadius).toBe("12px");
    expect(getComputedStyle(button.element()).fontSize).toBe("18px");

    root.style.setProperty("--ui-error", "magenta");
    expect(
      getComputedStyle(page.getByTestId("token-resource").element())
        .getPropertyValue("--color-resource-hp")
        .trim(),
    ).toBe("#f87171");
  } finally {
    html.className = originalClass;
    html.style.cssText = originalStyle;
    app.unmount();
    root.remove();
  }
});
