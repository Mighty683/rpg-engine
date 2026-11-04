# End-to-end tests

- Exercise complete user journeys through the frontend and backend. Avoid duplicating unit-level cases.
- Describe scenarios in Gherkin feature files and implement reusable step definitions with Cucumber.js, run through Vitest.
- Use page objects to separate selectors and UI interactions from step definitions. Steps call page objects and assert outcomes; page objects own selectors and UI interactions.
- Group step definitions by domain concept, independent of individual features or pages.
- Pass relevant entities explicitly in Gherkin steps. Keep the World focused on browser resources and necessary scenario context; avoid implicit selections such as the last-created game.
