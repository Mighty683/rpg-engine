# Testing

- We use vitest for both unit and browser e2e tests
- In unit tests we aim for code branch coverage not lines coverage, we test logic not code lines, simple components without logic can skip tests
- We make test cases by input not by output, so we test for given input all we can, do not split test cases when they can be one test we encourage multi assertions
- In browser tests we test users flows, we aim browser tests to not duplicate with unit tests, they test whole journeys, units particular logic
