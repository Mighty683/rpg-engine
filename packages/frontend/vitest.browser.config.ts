import { mergeConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import viteConfig from "./vite.config.ts";

export default mergeConfig(viteConfig, {
  test: {
    include: ["src/**/*.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
