# Development image for the compose stack: Node 26, the pinned pnpm, and workspace
# dependencies built for the container's Node runtime. Source code is not baked in;
# it arrives through a bind mount at /workspace.

FROM docker.io/library/node:26-bookworm

# Keep in sync with packageManager in package.json.
RUN npm install --global pnpm@12.21.0

WORKDIR /workspace

# Manifests only, so the dependency layer stays cached while source changes.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node packages/backend/package.json packages/backend/package.json
COPY --chown=node:node packages/frontend/package.json packages/frontend/package.json
COPY --chown=node:node packages/tests/package.json packages/tests/package.json

RUN chown node:node /workspace

# Install as the unprivileged node user so the runtime bind mount (userns keep-id)
# can write caches such as node_modules/.vite beside the image-provided dependencies.
USER node
RUN pnpm install --frozen-lockfile
