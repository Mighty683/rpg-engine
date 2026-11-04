import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [vue(), ui()]),
});
