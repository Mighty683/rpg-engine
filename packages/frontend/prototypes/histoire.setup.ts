import ui from "@nuxt/ui/vue-plugin";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineSetupVue3 } from "@histoire/plugin-vue";
import "../src/style.css";
import { providePrototypeApiServices } from "./api";

export const setupVue3 = defineSetupVue3(async ({ app }) => {
  if (typeof process === "undefined" || !process.versions?.node) {
    const { startPrototypeBackend } = await import("./mock-backend/browser");
    await startPrototypeBackend();
  }
  providePrototypeApiServices(app);
  app.use(createRouter({ history: createMemoryHistory(), routes: [] }));
  app.use(ui);
});
