import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: lazyPlugins(() => [vue(), ui()]),
});
