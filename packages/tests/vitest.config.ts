import { defineConfig, loadEnv } from "vite-plus";
import { fileURLToPath } from "node:url";
import { cucumber } from "@lotun/vitest-cucumber";

const testDatabaseUrl = loadEnv(
  "test",
  fileURLToPath(new URL(".", import.meta.url)),
  "",
).TEST_DATABASE_URL;
if (!process.env.TEST_DATABASE_URL && testDatabaseUrl)
  process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  plugins: [cucumber({ import: ["src/support/**/*.ts", "src/steps/**/*.ts"] })],
  test: { include: ["src/features/**/*.feature"], globalSetup: ["src/setup.ts"] },
});
