# UI conventions

- We use Nuxt UI and Tailwind with design tokens defined in `packages/frontend/src/tokens.css`. Primitive values use `--value-*`; components use semantic tokens and utilities. The prototype gallery documents the available tokens.
- Free values are not allowed, every tailwind class should use design system tokens with exception for width and height of elements
- We allow user to submit forms when form contains errors, submit is not disabled
- We only disable actions when they are hard blocked from user
- Display success messages as toast notifications, not as plain text in the page.
- While a form is saving, disable its fields and submit action until the save finishes.
