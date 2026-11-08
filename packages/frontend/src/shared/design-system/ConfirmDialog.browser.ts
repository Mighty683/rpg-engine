import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, defineComponent, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import "../../style.css";

test("confirmation can be cancelled or accepted", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const confirmed = ref(0);
  const wrapper = defineComponent({
    setup() {
      const open = ref(false);
      return () =>
        h(UApp, null, {
          default: () => [
            h(
              "button",
              {
                "data-testid": "open-confirm",
                onClick: () => {
                  open.value = true;
                },
              },
              "Open",
            ),
            h("span", { "data-testid": "confirm-count" }, String(confirmed.value)),
            h(ConfirmDialog, {
              open: open.value,
              title: "Remove item",
              confirmLabel: "Remove",
              destructive: true,
              confirmTestId: "confirm",
              cancelTestId: "cancel",
              onCancel: () => {
                open.value = false;
              },
              onConfirm: () => {
                confirmed.value++;
                open.value = false;
              },
            }),
          ],
        });
    },
  });
  const app = createApp(wrapper).use(ui);
  app.mount(root);
  try {
    await page.getByTestId("open-confirm").click();
    await page.getByTestId("cancel").click();
    await expect.element(page.getByTestId("confirm-count")).toHaveTextContent("0");
    await page.getByTestId("open-confirm").click();
    await page.getByTestId("confirm").click();
    await expect.element(page.getByTestId("confirm-count")).toHaveTextContent("1");
  } finally {
    app.unmount();
    root.remove();
  }
});
