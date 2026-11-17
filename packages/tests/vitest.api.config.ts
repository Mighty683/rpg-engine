import { defineConfig } from "vite-plus";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Run pnpm test:integration to provision PostgreSQL for API integration tests");
}

export default defineConfig({
  test: { include: ["src/api/**/*.integration.test.ts"] },
});
