# UI prototypes

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` for the gallery, or `pnpm --filter @rpg-engine/frontend prototypes:build` to type-check and build it into `packages/frontend/prototypes/dist`. The prototype build is separate from the production application.

Create a folder named after the task here, add Vue components for its proposed screens and states, and register the entry component in `PrototypeGallery.vue`. Use local sample data and interactions so prototypes can be reviewed without the backend. Reuse the application's components, styles, and design tokens where appropriate; prototype code is exploratory and does not imply production behavior. Link the prototype from the task's UI document and explain how to reach important states. Remove the example once it is no longer useful.

The Design system entry displays the shared tokens in `src/tokens.css`. Primitive `--value-*` properties contain concrete values; semantic `--space-*`, typography, radius, and Nuxt UI `--ui-*` properties describe their purpose. Use semantic Tailwind utilities such as `gap-small`, `p-large`, `text-heading`, `rounded-panel`, `bg-default`, and `text-muted` in application components. Nuxt UI owns additional component-level defaults; extend the shared tokens when the product needs a new semantic role.
