# RPG Engine

A web application for running tabletop RPG sessions. Session management and persistence have not yet been implemented.

## Development

The pnpm workspace contains the Vue application in `packages/frontend` and backend dependencies in `packages/backend`. Node.js and pnpm are required. The pnpm version is specified in the root `package.json`.

```sh
pnpm install
pnpm dev
```

Run `pnpm build` for frontend type checking and a production build, or `pnpm check` for frontend formatting and lint checks. Root `dev`, `build`, and `preview` commands target the frontend; use `pnpm --filter @rpg-engine/frontend <command>` to run its commands directly.

## Backend foundation

The project includes Express and Arrow Express for routing, and Drizzle ORM, Drizzle Kit, and the `pg` driver for PostgreSQL. A backend server, database schema, and migrations have not yet been implemented.

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
