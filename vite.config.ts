import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["packages/frontend/prototypes/public/mockServiceWorker.js"] },
  lint: {
    ignorePatterns: ["packages/frontend/prototypes/public/mockServiceWorker.js"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "sql-security", specifier: "./lint/sql-security.js" },
      { name: "prototype-boundary", specifier: "./lint/prototype-boundary.js" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "max-depth": ["error", 6],
    },
    overrides: [
      {
        files: ["packages/*/src/**/*.{js,jsx,ts,tsx,vue}"],
        rules: { "prototype-boundary/no-prototype-imports": "error" },
      },
      {
        files: ["packages/backend/src/**/*.ts"],
        rules: { "sql-security/static-query": "error", "sql-security/no-drizzle-raw": "error" },
      },
      {
        files: ["packages/backend/src/**/*.test.ts"],
        rules: { "sql-security/static-query": "off", "sql-security/no-drizzle-raw": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
});
