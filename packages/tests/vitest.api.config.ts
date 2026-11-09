import { defineConfig, loadEnv } from "vite-plus";
import { fileURLToPath } from "node:url";

const testDatabaseUrl = loadEnv(
  "test",
  fileURLToPath(new URL(".", import.meta.url)),
  "",
).TEST_DATABASE_URL;
if (!process.env.TEST_DATABASE_URL && testDatabaseUrl)
  process.env.TEST_DATABASE_URL = testDatabaseUrl;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable PostgreSQL database for API integration tests",
  );
}

export default defineConfig({
  test: { include: ["src/api/**/*.integration.test.ts"] },
});
