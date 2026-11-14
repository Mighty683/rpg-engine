# UI prototypes and design system

Run `pnpm --filter @rpg-engine/frontend prototypes:dev` to open Histoire. Browse **Design system** and **Domain** in its sidebar. Story data and interactions are local and reset on reload.

Run `pnpm --filter @rpg-engine/frontend prototypes:build` to type-check and build the book into `packages/frontend/prototypes/dist`, and `pnpm --filter @rpg-engine/frontend prototypes:preview` to serve the build. This is separate from the production application.

For a new prototype, create a task folder and a `*.story.vue` file with a `Prototypes/...` title. Add Histoire controls for review settings and use local sample data so it works without the backend. Reuse application components, styles, and design tokens where appropriate. Link the story from the task's UI document and explain how to reach important states.

The design-system stories document the tokens in `../src/tokens.css` and examples of shared components. Tailwind theme tokens and Nuxt UI color roles reference `--value-*` primitives directly. Use semantic utilities such as `gap-small`, `text-heading`, `rounded-panel`, and `bg-default` in components.

Design-system stories are organized under **Primitives** and **Base**. Base components live in `src/shared/design-system/base` and have no RPG dependencies. Each component or pattern has its own story; use its controls to inspect the available states.

**Domain** has individual stories for **Characters**, **Rolls**, and **Game management**, plus reusable **Fabula Ultima** controls from `src/shared/design-system/domain`. Domain controls may compose base components; base components must not import domain controls. These stories render components from the application modules with local fixtures.

## Shared mock backend

Histoire awaits `mock-backend/browser.ts` before mounting stories and provides the typed production API registry. MSW intercepts real HTTP clients; no production source imports this infrastructure. Its worker lives in `prototypes/public`, configured only for Histoire (including the static build). Serve previews over localhost or HTTPS so service workers work.

Import from `prototypes/api.ts`:

- `prototypeApiServices`: production-shaped `characters`, `games`, `gameTable`, and other registry clients. `providePrototypeApiServices(app)` installs them explicitly when needed outside the global setup.
- `prototypeGameId` (`prototype-game`) and `prototypePlayerId` (`member-nera`). Both game and player character routes share the same records.
- `resetPrototypeBackend(scenario?)` restores deterministic seed data; `setPrototypeScenario(scenario)` changes response behavior without clearing writes. Scenarios: `default`, `empty` (empty collections), `loading` (1.5-second delay), `error` (HTTP 500). Refetch controller data after either call. State is shared within a story iframe and resets on reload, not on every component mount.

The seeded full character sheets are distinct: `rowan` (Rowan Ash, Guardian with longsword) and `nera` (Nera Vale, Elementalist). Character PATCH requests enforce `expectedRevision`, merge resource/override changes, increment revisions, and feed subsequent character, roster, and party reads. This supports editing a sheet and refreshing its party card without parallel local fixtures. The backend also supplies members and deterministic roll history/create/delete endpoints. Roll records are review fixtures, not an authoritative rules engine. Unknown API requests fail with 404 instead of reaching a live backend; non-API assets pass through.

Keep network operations in prototype controllers, not view components. Use production clients for existing contracts. Do not start a second worker in individual stories. Reset state explicitly when starting an independent review scenario. Game EventSource streams are intercepted with an idle local SSE response; the prototype has no live server event delivery.
