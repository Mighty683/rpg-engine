# Cross-module tests

- Place cross-module adversarial HTTP API integration tests in `src/api`; use Vitest and test authorization bypasses and persisted effects. Run them with `pnpm --filter @rpg-engine/tests test:api` and a dedicated `TEST_DATABASE_URL`.
- Keep Gherkin browser tests focused on complete user journeys through the frontend and backend; avoid duplicating unit-level cases or adversarial API cases.
- Describe browser scenarios in Gherkin feature files and implement reusable step definitions with Cucumber.js, run through Vitest.
- Use page objects to separate selectors and UI interactions from step definitions. Steps call page objects and assert outcomes; page objects own selectors and UI interactions.
- Group step definitions by domain concept, independent of individual features or pages.
- Pass relevant entities explicitly in Gherkin steps. Keep the World focused on browser resources and necessary scenario context; avoid implicit selections such as the last-created game.
