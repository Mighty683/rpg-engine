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

## Backend foundation

The backend listens on `127.0.0.1:3000` by default; set `PORT` to change it. The frontend development server proxies `/api` to port 3000. Run `pnpm --filter @rpg-engine/backend migrate` against the target database before starting the backend. The migration is safe to rerun for this initial schema. Run `pnpm --filter @rpg-engine/backend build` for backend type checking and `pnpm exec vp test` for unit/API tests. Browser tests use Chromium (`pnpm --filter @rpg-engine/tests exec playwright install chromium`). Run frontend component browser tests with `pnpm --filter @rpg-engine/frontend test:browser`; they mock the API and require no backend. Full end-to-end tests use Gherkin feature files and Cucumber.js through Vitest in `packages/tests`: set `TEST_DATABASE_URL` to a dedicated PostgreSQL database with permission to create schemas, then run `pnpm --filter @rpg-engine/tests test`. The end-to-end setup starts the real frontend and backend on temporary ports and creates and removes an isolated database schema; it does not use `DATABASE_URL`. For deployment, serve the frontend and proxy `/api` to the backend.


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

The local connection URL is `postgresql://rpg_engine:local_dev_password@localhost:5432/rpg_engine`. Stop and restart the existing container with `podman stop rpg-engine-postgres` and `podman start rpg-engine-postgres`. The named volume preserves data across container recreation; PostgreSQL initialization variables only apply to an empty volume.

## AI skills and agents

Reusable skills live in `.agents/skills/` in the portable [Agent Skills](https://agentskills.io) format (`SKILL.md` + frontmatter). OpenCode discovers this directory automatically, and other compatible harnesses can use it too. Reviewer subagents are defined in `.opencode/agents/`.
