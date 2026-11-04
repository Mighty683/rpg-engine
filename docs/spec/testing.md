# Testing

- We use vitest for both unit and browser e2e tests
- In unit tests we aim for code branch coverage not lines coverage, we test logic not code lines, simple components without logic can skip tests
- We make test cases by input not by output, so we test for given input all we can, do not split test cases when they can be one test we encourage multi assertions
- Browser component tests belong to the frontend package and use regular Vitest tests with mocked API responses to exercise components or features without the application stack.
- Full end-to-end browser tests belong to `packages/tests`; follow its [package guidance](../../packages/tests/AGENTS.md).
- Use `data-testid` selectors in browser tests; do not use `getByRole` etc selectors
