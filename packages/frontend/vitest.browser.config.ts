import { mergeConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import viteConfig from "./vite.config.ts";

export default mergeConfig(viteConfig, {
  publicDir: "prototypes/public",
  test: {
    include: ["src/**/*.browser.ts", "prototypes/**/*.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
