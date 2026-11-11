# UI conventions

- We use Nuxt UI and Tailwind with design tokens defined in `packages/frontend/src/tokens.css`. Primitive values use `--value-*`; components use semantic tokens and utilities. The prototype gallery documents the available tokens.
- Free values are not allowed, every tailwind class should use design system tokens with exception for width and height of elements
- We allow user to submit forms when form contains errors, submit is not disabled
- We only disable actions when they are hard blocked from user
- Display success messages as toast notifications, not as plain text in the page.
- Display every API error as a toast notification, including validation and request failures. Do not render API error messages as red text in the page or beside fields. Use clear, actionable wording and preserve the user's input when possible.
- While a form is saving, disable its fields and submit action until the save finishes.

- Use the dark application palette; theme switching is not currently supported.

## Buttons

Use Nuxt UI `UButton` with the application's semantic color tokens. Choose emphasis by the action's role in its local context, not its position on the page. Use the default medium size unless a compact control is needed inside a dense component.

| Role            | Nuxt UI props                                          | Use                                                                                                                       |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Primary         | `color="primary" variant="solid"`                      | The main action in a screen, form, or dialog, such as creating a character. Limit to one primary action per action group. |
| Secondary       | `color="neutral" variant="outline"`                    | A visible alternative such as Cancel or Settings.                                                                         |
| Tertiary        | `color="neutral" variant="subtle"`                     | A contextual action such as viewing details or rotating a link. Its background makes it visibly interactive.              |
| Destructive     | `color="error" variant="outline"` or `variant="solid"` | Use outline for the initial removal action and solid for a destructive confirmation. Give the action a specific label.    |
| Navigation link | `text-primary underline`                               | Navigation to a destination. Use a semantic link with an underlined accent label and a visible keyboard focus state.      |

Use a descriptive text label. Icon-only buttons need an accessible name. Keep focus-visible states provided by Nuxt UI and use semantic button or link elements appropriate to the action. Do not use a disabled button to hide validation errors. During saving, disable the affected fields and submit action, and provide a visible loading indication. The design-system gallery shows the standard variants and states.
