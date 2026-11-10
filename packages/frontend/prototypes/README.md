# UI prototypes and design system

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` to open Histoire. Browse **Design system** and **Domain** in its sidebar. Story data and interactions are local and reset on reload.

Run `pnpm --filter @rpg-engine/frontend prototypes:build` to type-check and build the book into `packages/frontend/prototypes/dist`, and `pnpm --filter @rpg-engine/frontend prototypes:preview` to serve the build. This is separate from the production application.

For a new prototype, create a task folder and a `*.story.vue` file with a `Prototypes/...` title. Add Histoire controls for review settings and use local sample data so it works without the backend. Reuse application components, styles, and design tokens where appropriate. Link the story from the task's UI document and explain how to reach important states.

The design-system stories document the tokens in `../src/tokens.css` and examples of shared components. Tailwind theme tokens and Nuxt UI color roles reference `--value-*` primitives directly. Use semantic utilities such as `gap-small`, `text-heading`, `rounded-panel`, and `bg-default` in components.

Design-system stories are organized under **Primitives**, **Basic components**, and **Components**. Each component or pattern has its own story; use its controls to inspect the available states.

**Domain** has individual stories for **Characters**, **Rolls**, and **Game management**. These stories render components from the application modules with local fixtures.
