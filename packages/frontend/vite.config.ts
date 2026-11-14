import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
  plugins: lazyPlugins(() => [
    vue(),
    ui({
      colorMode: false,
      ui: {
        button: {
          slots: {
            // Nuxt variant classes also set outlines; keep the application focus tokens authoritative.
            base: "focus-visible:outline-(length:--focus-ring-width)! focus-visible:outline-(color:--focus-ring-color)! focus-visible:outline-offset-(length:--focus-ring-offset)!",
          },
        },
      },
    }),
  ]),
});
