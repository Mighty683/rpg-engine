# RPG Engine

A web application for running tabletop RPG sessions. Games can be created and saved in PostgreSQL; gameplay and session management are not yet implemented.

## Development

The pnpm workspace contains the Vue application in `packages/frontend` and backend dependencies in `packages/backend`. Node.js 22.18 or newer and pnpm are required. The pnpm version is specified in the root `package.json`.

```sh
pnpm install
cp packages/backend/.env.example packages/backend/.env
pnpm --filter @rpg-engine/backend migrate
pnpm dev
```

The backend loads `packages/backend/.env` when present; environment variables already set in the shell take precedence. `pnpm dev` starts both servers. Run `pnpm build` for frontend type checking and a production build. Run `pnpm check` for formatting, lint, and type checks across both packages, or `pnpm lint` for lint and type checks only. Shared Oxlint rules live in the root `vite.config.ts`, including a maximum block nesting depth of 6. Root `build` and `preview` commands target the frontend; use `pnpm --filter @rpg-engine/frontend <command>` or `pnpm --filter @rpg-engine/backend <command>` to run package commands directly.

To add optional local demo data after applying migrations, run `pnpm seed:demo` from the repository root. It creates **The Lantern Road**, a GM account (`demo-gm`), a player account (`demo-player`), and an active character for each. Both accounts use `demo-password` by default; set `DEMO_PASSWORD` before running the command to choose another password. This is development data, and the command refuses to run with `NODE_ENV=production`. Rerunning it leaves an existing demo game and its data unchanged. If either demo username is already taken, the transaction fails without changing existing data.

## Backend foundation

The backend listens on `127.0.0.1:3000` by default; set `PORT` to change it. The frontend development server proxies `/api` to port 3000. Run `pnpm --filter @rpg-engine/backend migrate` against the target database before starting the backend. The migration is safe to rerun for this initial schema. Run `pnpm --filter @rpg-engine/backend build` for backend type checking and `pnpm exec vp test` for unit/API tests. Browser tests use Chromium (`pnpm --filter @rpg-engine/tests exec playwright install chromium`). Run frontend component browser tests with `pnpm --filter @rpg-engine/frontend test:browser`; they mock the API and require no backend. Cross-module adversarial API tests live in `packages/tests/src/api`; set `TEST_DATABASE_URL` to a dedicated PostgreSQL database and run `pnpm --filter @rpg-engine/tests test:api`. Browser end-to-end tests use Gherkin feature files and Cucumber.js through Vitest in `packages/tests`: set `TEST_DATABASE_URL` to a dedicated PostgreSQL database with permission to create schemas, then run `pnpm --filter @rpg-engine/tests test`. The end-to-end setup starts the real frontend and backend on temporary ports and creates and removes an isolated database schema; it does not use `DATABASE_URL`. For deployment, serve the frontend and proxy `/api` to the backend.

The migration command uses Drizzle's PostgreSQL migrator and the SQL files and journal in `packages/backend/drizzle`. The schema is maintained in SQL, not generated from a Drizzle TypeScript schema; add new SQL migrations to the journal in order. Drizzle records applied migrations in the current PostgreSQL schema; the browser test stack uses its isolated schema for the same migration history. This migration setup starts from a fresh database and does not import the former `schema_migrations` history.


#### Backend mutation testing

Run `pnpm --filter @rpg-engine/backend test:mutation` for mutation testing without a database. To include backend module-level PostgreSQL integration tests, set `TEST_DATABASE_URL` to a dedicated database whose user can create and drop schemas. The cross-module API suite runs separately with `pnpm --filter @rpg-engine/tests test:api` and is not included in the backend mutation run. Stryker writes a report to `packages/backend/reports/mutation/mutation.html`; each run replaces the previous report. A full run can take a long time; focus it with `pnpm --filter @rpg-engine/backend test:mutation -- --mutate src/modules/auth/guards.ts`. Three older suites (`migrations.test.ts`, `games.test.ts`, and `character-setup-api.test.ts`) are excluded until updated for the current API and migrations.

## Deployment configuration

Serve the frontend and `/api` from the same public origin, and configure the frontend server to return the application for deep links such as `/invite/:token`. Set `APP_ORIGIN` to the exact public browser origin, including scheme and port where applicable, with no trailing slash. The backend requires that origin on browser writes and uses it to build invitation URLs. When `APP_ORIGIN` is unset in development, same-origin requests on localhost or 127.0.0.1 are accepted on any port, and invitation links use the current browser origin.

Set `INVITATION_SECRET` to a unique secret of at least 32 bytes and keep it stable across restarts. Invitation tokens are encrypted with this secret so GMs can copy their links later; changing or losing it makes stored tokens unreadable. The example value is for local development only. Keep production secrets outside the repository.

Set `NODE_ENV=production` and serve the public origin over HTTPS. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Configure the proxy to forward same-origin requests and stream `/api` server-sent events without buffering or a premature timeout. Event delivery and stream revocation are currently in memory: run one backend process until shared event delivery is implemented for multiple processes. Sign-in throttling uses the address visible to the backend; when all traffic arrives through one proxy, users share that proxy's limit.

The account and ownership migration assumes a fresh or deliberately reset database. Existing anonymous games and characters do not have an account identity from which to infer ownership; do not run this migration against data that must be retained without a separate migration plan.

### Local PostgreSQL with Podman

Build the image and start a database (the password below is for local development only):

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

The local connection URL is `postgresql://rpg_engine:local_dev_password@localhost:5432/rpg_engine`. Create a separate database for tests with `podman exec rpg-engine-postgres createdb -U rpg_engine -O rpg_engine rpg_engine_test`, then copy `packages/tests/.env.example` to `packages/tests/.env` and adjust its connection URL if needed. The API and end-to-end test commands load that file automatically; an existing `TEST_DATABASE_URL` environment variable takes precedence. Tests create and remove isolated schemas inside the test database. Stop and restart the existing container with `podman stop rpg-engine-postgres` and `podman start rpg-engine-postgres`. The named volume preserves data across container recreation; PostgreSQL initialization variables only apply to an empty volume.

## AI skills and agents

Reusable skills live in `.agents/skills/` in the portable [Agent Skills](https://agentskills.io) format (`SKILL.md` + frontmatter). OpenCode discovers this directory automatically, and other compatible harnesses can use it too. Reviewer subagents are defined in `.opencode/agents/`.
