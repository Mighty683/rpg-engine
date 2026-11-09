# RPG Engine

A web application for tabletop RPGs.

## Development

Requirements: Node.js 22.18 or newer, pnpm (version in `package.json`), and PostgreSQL.

1. Install dependencies and configure the backend:

   ```sh
   pnpm install
   cp packages/backend/.env.example packages/backend/.env
   ```

2. Set the database connection in `packages/backend/.env` and apply migrations:

   ```sh
   pnpm --filter @rpg-engine/backend migrate
   ```

3. Start the frontend and backend:

   ```sh
   pnpm dev
   ```

The backend loads `packages/backend/.env`; shell environment variables take precedence. It listens on `127.0.0.1:3000` by default (`PORT` overrides the port), and the frontend dev server proxies `/api` to port 3000.

### Commands

- `pnpm build` — type-check and build the frontend.
- `pnpm check` — check formatting, lint, and types across both packages.
- `pnpm lint` — check lint and types.
- `pnpm --filter @rpg-engine/backend build` — type-check the backend.
- `pnpm --filter @rpg-engine/frontend <command>` or `pnpm --filter @rpg-engine/backend <command>` — run a package command. Root `build` and `preview` target the frontend.

Shared Oxlint rules are in the root `vite.config.ts`, including a maximum block nesting depth of 6.

### Demo data

Run `pnpm seed:demo` after migrations to create **The Lantern Road**, a GM account (`demo-gm`), a player account (`demo-player`), and an active character for each. Both accounts use `demo-password` by default; set `DEMO_PASSWORD` to change it.

The command refuses to run in production. Reruns leave an existing demo game unchanged; if either username is taken, the transaction fails without changing existing data.

### Local PostgreSQL with Podman

Start a local database:

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

The development URL is `postgresql://rpg_engine:local_dev_password@localhost:5432/rpg_engine`. The password is for local use only.

- Create a separate test database: `podman exec rpg-engine-postgres createdb -U rpg_engine -O rpg_engine rpg_engine_test`.
- Copy `packages/tests/.env.example` to `packages/tests/.env` and adjust the URL if needed. An existing `TEST_DATABASE_URL` takes precedence.
- Stop or restart the container with `podman stop rpg-engine-postgres` or `podman start rpg-engine-postgres`.

The named volume preserves data across container recreation. PostgreSQL initialization variables apply only to an empty volume.

## Testing

- Run unit and API tests: `pnpm exec vp test`.
- Install Chromium for browser tests: `pnpm --filter @rpg-engine/tests exec playwright install chromium`.
- Run frontend component tests: `pnpm --filter @rpg-engine/frontend test:browser`. These mock the API and need no backend.
- Run cross-module API tests: `pnpm --filter @rpg-engine/tests test:api`.
- Run end-to-end tests: `pnpm --filter @rpg-engine/tests test`. These use Gherkin and Cucumber.js through Vitest and start the real frontend and backend on temporary ports.

API and end-to-end tests require `TEST_DATABASE_URL` pointing to a dedicated PostgreSQL database with permission to create schemas. They load `packages/tests/.env` automatically and create and remove isolated schemas. End-to-end tests do not use `DATABASE_URL`.

### Mutation testing

Run `pnpm --filter @rpg-engine/backend test:mutation` without a database. Set `TEST_DATABASE_URL` to a dedicated database whose user can create and drop schemas to include backend PostgreSQL integration tests. The cross-module API suite runs separately and is not included.

- Focus a run: `pnpm --filter @rpg-engine/backend test:mutation -- --mutate src/modules/auth/guards.ts`.
- View the report at `packages/backend/reports/mutation/mutation.html`; each run replaces it.

Full runs can take a long time. Three older suites (`migrations.test.ts`, `games.test.ts`, and `character-setup-api.test.ts`) are excluded until updated for the current API and migrations.

## Database migrations

Run `pnpm --filter @rpg-engine/backend migrate` before starting the backend. The initial migration is safe to rerun. Drizzle's PostgreSQL migrator uses the SQL files and journal in `packages/backend/drizzle` and records applied migrations in the current schema. Add new migrations to the journal in order.

SQL migrations are the source of truth for schema constraints. Keep Drizzle table definitions aligned with columns used by application queries. Services receive typed Drizzle database or transaction objects; `pg` is limited to pool lifecycle and the migration runner.

The migration setup starts from a fresh database and does not import the former `schema_migrations` history. The account and ownership migration also assumes a fresh or deliberately reset database: existing anonymous games and characters cannot be assigned an owner without a separate migration plan.

## Deployment

- Serve the frontend and `/api` from the same public origin. Proxy `/api` to the backend and return the application for deep links such as `/invite/:token`.
- Set `APP_ORIGIN` to the exact public browser origin, including scheme and port where applicable, without a trailing slash. It controls browser write origin checks and invitation URLs. In development, when unset, localhost and 127.0.0.1 same-origin requests are accepted on any port and invitations use the browser origin.
- Set `INVITATION_SECRET` to a unique secret of at least 32 bytes and keep it stable across restarts. Losing or changing it makes stored invitation tokens unreadable. The example value is for local development only.
- Set `CSRF_SECRET` to a unique cryptographically random secret of at least 32 bytes, shared by all backend instances. Browser writes use session-bound CSRF tokens as well as origin checks.
- Set `NODE_ENV=production` and use HTTPS. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Keep production secrets outside the repository.
- Configure the proxy to stream `/api` server-sent events without buffering or premature timeouts. Run one backend process until shared event delivery is implemented; event delivery and stream revocation are currently in memory.
- Set `TRUSTED_PROXIES` to comma-separated exact trusted addresses or CIDR ranges, such as `127.0.0.1/32`, and ensure those proxies overwrite forwarded headers. In production it is required; use `none` only for direct access. Untrusted forwarded addresses make users behind a proxy share its rate limit. Do not trust unverified clients or use an unrestricted proxy setting.
- Configure security headers and an appropriate CSP on the frontend server. Helmet sets headers on API responses.

Login is rate-limited by client address and account, and registration by client address; counters are stored in PostgreSQL. Password hashing is capped per backend process.

### Database roles

1. Create separate PostgreSQL login roles: a migration owner that owns the application schema and tables, and a runtime role without superuser, database/schema ownership, role creation, or privileged role membership. Set passwords through the database administration or secrets system.
2. Set `MIGRATION_DATABASE_URL` for migrations and `DATABASE_URL` for the backend runtime. Production migrations require `MIGRATION_DATABASE_URL`; development may fall back to `DATABASE_URL`. Keep migration credentials away from the runtime role.
3. Run migrations as the schema owner, then apply runtime grants as that owner, replacing the existing role and schema names:

   ```sh
   psql "$MIGRATION_DATABASE_URL" -v app_schema=public -v app_role=rpg_runtime -f packages/backend/scripts/runtime-grants.sql
   ```

4. Give the runtime role database `CONNECT` and ensure its `search_path` selects the application schema. Check effective privileges, including `PUBLIC` and inherited grants: the script adds permissions but does not remove existing ones or create roles.
5. Review and rerun the grant script after migrations that add database objects. It excludes the migration history table and does not automatically grant access to future tables.

A database administrator must apply these steps to the deployed database.

SQL query construction is checked by an Oxlint plugin through `pnpm lint` and `pnpm check`, including SQL security CI. It detects dynamic text in direct `.query(...)` and `["query"](...)` calls and direct Drizzle `sql.raw()` calls in backend production TypeScript. It does not analyze indirect database APIs or SQL migrations.

## AI skills and agents

Reusable skills live in `.agents/skills/` in the portable [Agent Skills](https://agentskills.io) format. OpenCode discovers them automatically; other compatible harnesses can also use them. Reviewer subagents are defined in `.opencode/agents/`.
