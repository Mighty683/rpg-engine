import ui from "@nuxt/ui/vue-plugin";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineSetupVue3 } from "@histoire/plugin-vue";
import "../src/style.css";

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.use(createRouter({ history: createMemoryHistory(), routes: [] }));
  app.use(ui);
});
