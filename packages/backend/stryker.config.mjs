/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ["src/**/*.ts", "!src/**/*.test.ts"],
  testFiles: [
    "src/modules/auth/guards.test.ts",
    "src/modules/characters/access.test.ts",
    "src/modules/fabula/rules.test.ts",
    "src/modules/games/access.test.ts",
    "src/modules/players/membership-permissions.test.ts",
    ...(process.env.TEST_DATABASE_URL
      ? [
          "src/modules/auth/sessions.integration.test.ts",
          "src/modules/characters/characters.integration.test.ts",
          "src/modules/players/active-selection.integration.test.ts",
        ]
      : []),
  ],
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: { dir: "src", related: false },
  reporters: ["progress", "clear-text", "html"],
  concurrency: 2,
};
