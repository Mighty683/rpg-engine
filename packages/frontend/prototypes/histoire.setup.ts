import ui from "@nuxt/ui/vue-plugin";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineSetupVue3 } from "@histoire/plugin-vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import "../src/style.css";
import { providePrototypeApiServices } from "./api";

export const setupVue3 = defineSetupVue3(async ({ app }) => {
  if (typeof process === "undefined" || !process.versions?.node) {
    document.documentElement.classList.add("dark");
    const { startPrototypeBackend } = await import("./mock-backend/browser");
    await startPrototypeBackend();
  }
  providePrototypeApiServices(app);
  const notesPreview = () => import("./game-notes/NotesPreview.vue");
  app.use(
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/games/:gameId", component: notesPreview },
        { path: "/games/:gameId/notes", component: notesPreview },
        { path: "/games/:gameId/notes/new", component: notesPreview },
      ],
    }),
  );
  app.use(VueQueryPlugin, { queryClient: new QueryClient() });
  app.use(ui);
});
