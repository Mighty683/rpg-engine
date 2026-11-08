import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "sql-security", specifier: "./lint/sql-security.js" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "max-depth": ["error", 6],
    },
    overrides: [
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
