import { HstVue } from "@histoire/plugin-vue";
import { defineConfig } from "histoire";

export default defineConfig({
  plugins: [HstVue()],
  storyMatch: ["prototypes/**/*.story.vue"],
  setupFile: "./prototypes/histoire.setup.ts",
  vite: { ssr: { noExternal: ["@nuxt/ui"] } },
  outDir: "prototypes/dist",
});
