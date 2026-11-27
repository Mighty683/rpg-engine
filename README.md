# RPG Engine

Web application for playing tabletop RPGs online — Fabula Ultima system. GM prepares a game and invites players; the shared game table stays in sync in real time.

- Live game table: chat, dice throws, private GM rolls
- Characters, class catalog, levels, skills per the [Fabula Ultima spec](docs/spec/fabula-ultima/README.md)
- NPC/enemy roster with hidden, visible, known information
- AI GM table assistant, backed by Mistral
- OpenAPI 3.1 + Swagger UI; PostgreSQL + pgvector

## Application architecture

```mermaid
flowchart TB
    Browser["Browser"]

    subgraph FE["packages/frontend — Vue 3, Nuxt UI"]
        Views["View components"]
        Controllers["Controller components<br/>application state and API access"]
        Views --- Controllers
    end

    subgraph BE["packages/backend — Express 5, Node.js 26"]
        Contracts["JSON Schema validation (Ajv)<br/>canonical OpenAPI 3.1, Swagger UI"]
        Modules["Domain modules<br/>auth, games, characters, class-catalog, npcs,<br/>throws, game-notes, invitations, fabula, agent"]
        SSE["Live events (SSE)<br/>heartbeats, per-account capacity"]
    end

    DB[("PostgreSQL 17 + pgvector<br/>Drizzle migrations")]
    Mistral["Mistral AI API<br/>chat and embeddings"]

    Browser --> Views
    Controllers -->|"REST /api"| Contracts
    Contracts --> Modules
    Modules --> DB
    Modules --> SSE
    SSE -->|"server-sent events"| Controllers
    Modules -->|"GM table agent: chat, retrieval"| Mistral
```

- Monorepo (pnpm): `packages/frontend`, `packages/backend`, `packages/tests`
- Backend: modular monolith, one folder per domain, JSON Schema + Ajv validation, canonical OpenAPI document, Drizzle migrations, SSE live events
- Frontend: views (render only) / controllers (state, API), injected API services, prototypes with mock backend in `packages/frontend/prototypes`
- Security: Helmet, session cookies, CSRF, origin checks, PostgreSQL-backed rate limits, one JSON error boundary with request IDs, graceful shutdown

## AI workflow

Built end-to-end with AI agents. The whole process — standards, skills, task docs, reviewer agents — is committed to the repo, so any agent session continues the same way.

```mermaid
flowchart TD
    subgraph CTX["Committed agent context — loaded into every session"]
        SPECS["AGENTS.md and docs/spec<br/>standards, conventions, Fabula Ultima rules"]
        SKILLS[".agents/skills<br/>reusable workflow skills, portable Agent Skills format"]
        REVIEWERS[".opencode/agents<br/>architecture, UI design, persona UX reviewers"]
    end

    subgraph DOCS["Task folder under docs/tasks, workflow in the open"]
        direction LR
        STORY["1. story.md<br/>user story"] --> UX["2. ux.md<br/>screen map, prototype"]
        UX --> TECH["3. tech.md<br/>data flows, OpenAPI, migrations"]
        TECH --> HANDOVER["4. handover.md<br/>acceptance criteria, required test IDs"]
        HANDOVER --> PLAN["5. plan.md<br/>delivery waves, edit boundaries"]
    end

    IMPL["Implementation subagents<br/>one per wave, inside its edit boundary"]
    REV["Reviewer subagents<br/>architecture, UI design, persona UX"]
    GATE["Quality gates — pnpm verify<br/>check, builds, unit, component,<br/>integration, E2E tests, secret scan"]
    DONE["handover.md<br/>verification evidence recorded"]
    ARC["Task archived<br/>docs/tasks/archive"]

    PLAN --> IMPL
    IMPL --> REV
    IMPL --> GATE
    REV -.->|"findings"| IMPL
    GATE --> DONE
    REV --> DONE
    DONE --> ARC
```

Pipeline:

1. **Task docs before code** — `story.md` → `ux.md` (screen map, prototype) → `tech.md` (ER, data flows, OpenAPI, migrations) → `handover.md` (acceptance criteria, required test IDs)
2. **Plan** — delivery waves, exclusive edit boundaries, one subagent per wave, one owner per shared contract
3. **Implement** — reviewer subagents in parallel: architecture · UI design · persona UX; findings loop back to builders
4. **Verify** — `pnpm verify` = CI checks (format, lint, types, OpenAPI, unit, component, integration, E2E) + pre-push hook + Trivy secret scan
5. **Close** — evidence into `handover.md`, task archived to `docs/tasks/archive`

Source of truth for agents and people: `AGENTS.md`, `docs/spec`, `docs/tasks`, skills in `.agents/skills` (portable [Agent Skills](https://agentskills.io) format, auto-discovered by OpenCode), reviewers in `.opencode/agents/`.

## Development

- Requirements: Node.js 26+, pnpm (pinned in `package.json`), PostgreSQL 17 + pgvector, Podman
- Chromium for browser tests: `pnpm --filter @rpg-engine/tests exec playwright install chromium`
- Pre-push hook: `pnpm hooks:install` → `pnpm verify` + Trivy scan; CI mirrors it in 4 jobs: secrets, lint, test, integration

### Demo data

Run `pnpm seed:demo` after migrations. Sign in as **`demo-player`** to choose between **The Lantern Road**, **Glasswater Isles**, and **The Ember Archive**. Each new campaign starts with two notes, two equipped player characters, four rolls, and a GM character with a learned class skill. The Lantern Road also includes three NPCs at different visibility levels.

- `demo-gm` runs The Lantern Road and The Ember Archive and plays in Glasswater Isles. `demo-keeper` runs Glasswater Isles. `demo-scout` plays in The Lantern Road and The Ember Archive.
- New accounts use `demo-password` unless `DEMO_PASSWORD` is set.
- Reruns add missing demo games and accounts and preserve existing campaigns, including an older Lantern Road. A username collision rolls back the seed. The command refuses to run in production.
- Reset: `pnpm seed:demo --reset` — destructive, loopback host only

### Local PostgreSQL with Podman

```sh
podman build -t rpg-engine-postgres -f docker/postgres/Dockerfile .
podman volume create rpg-engine-postgres-data
podman run -d --name rpg-engine-postgres \
  -e POSTGRES_USER=rpg_engine \
  -e POSTGRES_PASSWORD=local_dev_password \
  -e POSTGRES_DB=rpg_engine \
  -p 127.0.0.1:5432:5432 \
  -v rpg-engine-postgres-data:/var/lib/postgresql/data \
  rpg-engine-postgres
```

- URL: `postgresql://rpg_engine:local_dev_password@localhost:5432/rpg_engine` — local password only; init vars apply to an empty volume; data survives recreation
- The image enables pgvector automatically on a fresh volume. For an existing volume where pgvector is not yet enabled, run this once before migrating:

  ```sh
  podman exec rpg-engine-postgres psql -U rpg_engine -d rpg_engine -c 'CREATE EXTENSION IF NOT EXISTS vector;'
  ```

- Stop/start: `podman stop rpg-engine-postgres` / `podman start rpg-engine-postgres`

## Testing

- `pnpm test` — unit + API tests, no backend
- `pnpm --filter @rpg-engine/frontend test:browser` — component tests, mocked API
- `pnpm test:integration` — backend PostgreSQL tests + cross-module API tests + browser E2E; disposable `pgvector/pgvector:pg17` container (Podman), browser suite inside the official Playwright image; `TEST_DATABASE_URL` reuses a disposable database and runs the browser suite on the host
- Conventions: branch coverage over line coverage, cases grouped by input, tests next to source, adversarial API tests in `packages/tests/src/api`, Gherkin browser journeys, `data-testid` selectors — see the [testing spec](docs/spec/testing.md)

### Mutation testing

- `pnpm --filter @rpg-engine/backend test:mutation` — no database; `TEST_DATABASE_URL` adds backend integration tests
- Focus: `-- --mutate src/modules/auth/guards.ts`; report: `packages/backend/reports/mutation/mutation.html`; suites from `stryker.config.mjs`

## Database migrations

- `pnpm --filter @rpg-engine/backend migrate` before backend start
- SQL files + journal in `packages/backend/drizzle`; migrations are the source of truth for constraints; keep Drizzle definitions aligned
- Fresh database assumed; no former `schema_migrations` import

## Deployment

- One origin: serve frontend + proxy `/api`, return the app on deep links (`/invite/:token`), stream SSE without buffering
- `APP_ORIGIN`: exact browser origin, no trailing slash; `NODE_ENV=production`; HTTPS; cookies `HttpOnly`, `SameSite=Lax`, `Secure`
- `INVITATION_SECRET`, `CSRF_SECRET`: unique random, ≥32 bytes, stable across restarts, outside the repo
- One backend process (event registry in memory)
- `TRUSTED_PROXIES`: exact addresses/CIDRs, required in production; CSP on the frontend server; Helmet on API responses
- DB deadlines: 5s connect / 10s statement / 2s lock / 10s idle — override with `DB_*_TIMEOUT_MS`; rate limits: login, registration, game and invitation writes (60/min/account), SSE capacity 8/account, 256 total
- Errors: one JSON boundary — `503 database_busy`, `500 server_error`, `X-Request-Id`, safe logs (no bodies, URLs, cookies, SQL)
- Shutdown: drain ≤10s + pool close — allow termination grace

### GM table Agent

- Disabled by default. Enable: migrations + grants, then `AGENT_ENABLED=true`, `MISTRAL_MODEL=mistral-small-2603`, `MISTRAL_API_KEY`, restart
- Sends GM messages + requested game facts to Mistral — set provider retention and test on a synthetic game first
- Rolls: **Make a roll** in chat, confirmed roll shows dice + total; conversations persist in PostgreSQL; 1 turn per game, ≤10 per process

### Database roles

1. Two login roles: migration owner (schema, tables) + runtime role (no superuser, no ownership, no role management)
2. `MIGRATION_DATABASE_URL` for migrations (required in production), `DATABASE_URL` for runtime
3. Migrate as owner, then grants as owner:

   ```sh
   psql "$MIGRATION_DATABASE_URL" -v app_schema=public -v app_role=rpg_runtime -f packages/backend/scripts/runtime-grants.sql
   ```

4. Verify effective privileges (script adds, never removes); rerun after migrations adding objects; DBA applies these steps
- Static SQL guard: Oxlint plugin (via `pnpm lint`, `pnpm check`) flags dynamic text in `.query(...)` and Drizzle `sql.raw()` in backend production code

## Commands

| Command | Description |
| --- | --- |
| `pnpm install` | Install dependencies. |
| `pnpm dev` | Frontend + backend dev servers. |
| `pnpm dev:compose` | One command: db + backend + frontend in containers. |
| `pnpm compose:down` | Stop and remove the compose stack. |
| `pnpm build` | Type-check + build frontend. |
| `pnpm preview` | Preview built frontend. |
| `pnpm lint` | Lint + types. |
| `pnpm check` | Format, lint, types, OpenAPI lint + bundle. |
| `pnpm test` | Unit + API tests. |
| `pnpm --filter @rpg-engine/frontend test:browser` | Component tests, mocked API. |
| `pnpm test:integration` | Integration + E2E suites. |
| `pnpm --filter @rpg-engine/backend test:mutation` | Mutation testing. |
| `pnpm --filter @rpg-engine/backend migrate` | Apply migrations. |
| `pnpm seed:demo` | Demo campaigns, accounts, and play history. |
| `pnpm seed:demo --reset` | Destructive: wipe, migrate, reseed. |
| `pnpm verify` | Full gate — same checks as CI. |
| `pnpm hooks:install` | Install pre-push hook. |
| `pnpm scan:secrets` | Trivy secret scan. |
| `pnpm --filter @rpg-engine/tests exec playwright install chromium` | One-time Chromium install. |

Package-scoped: `pnpm --filter @rpg-engine/frontend <command>`, `pnpm --filter @rpg-engine/backend <command>`; root `build`/`preview` target the frontend.

## Run the project

### One command with Podman Compose

```sh
pnpm dev:compose
```

- Starts: PostgreSQL 17 (pgvector) + migrations + backend + frontend; image builds on Node 26 with pinned pnpm; rebuild is automatic (`up --build`)
- URLs = host flow: Vite `127.0.0.1:5173` → `/api` → backend `127.0.0.1:3000`, db `127.0.0.1:5432`, Swagger [127.0.0.1:3000/api-docs](http://127.0.0.1:3000/api-docs/)
- Live editing: source bind-mounted — `node --watch` backend restart, Vite HMR
- Demo data: `podman compose exec backend pnpm seed:demo`; sign in `demo-gm` / `demo-password` (player: `demo-player`)
- Stop: `pnpm compose:down`; data persists in the `postgres-data` volume
- Ports taken: `DEV_DB_PORT=15432 DEV_BACKEND_PORT=13000 DEV_FRONTEND_PORT=15173 pnpm dev:compose`
- Needs: Podman with compose provider (`podman compose version`); app containers use rootless host networking + `userns=keep-id`, same as the integration tests

### Manual setup

1. Requirements: Node.js 26+, pnpm 12, Podman, PostgreSQL 17 + pgvector

2. Install + configure:

   ```sh
   pnpm install
   cp packages/backend/.env.example packages/backend/.env
   ```

3. Start a database ([Local PostgreSQL with Podman](#local-postgresql-with-podman)), set `DATABASE_URL`, enable the `vector` extension

4. Migrate + seed:

   ```sh
   pnpm --filter @rpg-engine/backend migrate
   pnpm seed:demo
   ```

5. Run: `pnpm dev` — backend `127.0.0.1:3000` (`PORT` overrides, shell vars beat `.env`), frontend proxies `/api`, [Swagger UI](http://127.0.0.1:3000/api-docs/), [OpenAPI bundle](http://127.0.0.1:3000/openapi.json)

6. Optional agent: `AGENT_ENABLED=true`, `MISTRAL_MODEL`, `MISTRAL_API_KEY`, restart
