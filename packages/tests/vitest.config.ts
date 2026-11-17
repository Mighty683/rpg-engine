import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import { cucumber } from "@lotun/vitest-cucumber";

export default defineConfig({
  plugins: [cucumber({ import: ["src/support/**/*.ts", "src/steps/**/*.ts"] })],
  // The Cucumber plugin must register tests against this runner's Vitest instance.
  resolve: {
    alias: [{ find: /^vitest$/, replacement: fileURLToPath(import.meta.resolve("vitest")) }],
  },
  test: {
    include: ["src/features/**/*.feature"],
    globalSetup: ["src/setup.ts"],
    server: { deps: { inline: ["@lotun/vitest-cucumber"] } },
  },
});
