# UI prototypes

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` for the gallery, or `pnpm --filter @rpg-engine/frontend prototypes:build` to type-check and build it into `packages/frontend/prototypes/dist`. The prototype build is separate from the production application.

Create a folder named after the task here, add Vue components for its proposed screens and states, and register the entry component in `PrototypeGallery.vue`. Use local sample data and interactions so prototypes can be reviewed without the backend. Reuse the application's components, styles, and design tokens where appropriate; prototype code is exploratory and does not imply production behavior. Link the prototype from the task's UI document and explain how to reach important states. Remove the example once it is no longer useful.

The Design system entry previews the shared tokens in `../src/tokens.css`. Tailwind theme tokens and Nuxt UI color roles reference `--value-*` primitives directly. Use semantic utilities such as `gap-small`, `text-heading`, `rounded-panel`, and `bg-default` in components.
