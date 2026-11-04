import { defineConfig } from "vite-plus";
import { cucumber } from "@lotun/vitest-cucumber";

export default defineConfig({
  plugins: [cucumber({ import: ["src/support/**/*.ts", "src/steps/**/*.ts"] })],
  test: { include: ["src/features/**/*.feature"], globalSetup: ["src/setup.ts"] },
});
