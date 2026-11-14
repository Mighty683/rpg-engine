import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h, ref } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import FormActions from "./FormActions.vue";
import "../../../style.css";

test("form actions separate cancel from submit and lock both while pending", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const pending = ref(false);
  const blocked = ref(false);
  const submit = vi.fn();
  const cancel = vi.fn();
  const app = createApp({
    render: () =>
      h(
        "form",
        {
          onSubmit: (event: Event) => {
            event.preventDefault();
            submit();
          },
        },
        [
          h(FormActions, {
            submitLabel: "Save",
            pending: pending.value,
            blocked: blocked.value,
            submitTestId: "save",
            cancelTestId: "cancel",
            onCancel: cancel,
          }),
        ],
      ),
  }).use(ui);
  app.mount(root);
  try {
    await page.getByTestId("cancel").click();
    expect(cancel).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    await page.getByTestId("save").click();
    expect(submit).toHaveBeenCalledOnce();
    pending.value = true;
    await expect.element(page.getByTestId("save")).toBeDisabled();
    await expect.element(page.getByTestId("cancel")).toBeDisabled();
    pending.value = false;
    blocked.value = true;
    await expect.element(page.getByTestId("save")).toBeDisabled();
    await expect.element(page.getByTestId("cancel")).toBeEnabled();
    blocked.value = false;
    await expect.element(page.getByTestId("save")).toBeEnabled();
  } finally {
    app.unmount();
    root.remove();
  }
});
