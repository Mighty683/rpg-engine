import { expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { createApp, h } from "vue";
import ui from "@nuxt/ui/vue-plugin";
import UApp from "@nuxt/ui/components/App.vue";
import AccountScreen from "./AccountScreen.vue";
import { apiServicesKey } from "../../shared/api-services";
import { browserApiServices } from "../../shared/api-services.browser-support";
import "../../style.css";

test("sign-in locks fields and mode while pending and preserves entries after failure", async () => {
  let rejectRequest!: (reason: Error) => void;
  const login = vi.fn(
    () =>
      new Promise<never>((_, reject) => {
        rejectRequest = reject;
      }),
  );
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp({ render: () => h(UApp, null, { default: () => h(AccountScreen) }) })
    .provide(apiServicesKey, { ...browserApiServices, auth: { ...browserApiServices.auth, login } })
    .use(ui);
  app.mount(root);
  try {
    const username = page.getByTestId("auth-username");
    const password = page.getByTestId("auth-password");
    const mode = page.getByTestId("auth-mode");
    await username.fill("gamemaster");
    await password.fill("password123");
    await page.getByTestId("auth-submit").click();
    await expect.element(username).toBeDisabled();
    await expect.element(password).toBeDisabled();
    await expect.element(mode).toBeDisabled();
    expect(login).toHaveBeenCalledExactlyOnceWith("gamemaster", "password123");
    rejectRequest(new Error("offline"));
    await expect.element(username).toBeEnabled();
    await expect.element(password).toBeEnabled();
    await expect.element(mode).toBeEnabled();
    await expect.element(username).toHaveValue("gamemaster");
    await expect.element(password).toHaveValue("password123");
  } finally {
    app.unmount();
    root.remove();
  }
});
