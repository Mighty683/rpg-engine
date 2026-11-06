import { defineConfig } from "vite-plus";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable PostgreSQL database for API integration tests",
  );
}

export default defineConfig({
  test: { include: ["src/api/**/*.integration.test.ts"] },
});
