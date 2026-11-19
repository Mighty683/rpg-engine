# Technical decisions

## Backend deployment

Run one backend process, serving multiple users. Live events and connection revocation remain in memory. Multiple backend instances and shared event infrastructure are out of scope.

## Backend validation

Keep Express and validate request structure with JSON Schema compiled by Ajv. Keep schemas in their owning modules and reuse shared validation helpers. Authorization and domain invariants remain in services and transactions. Check structural parity with canonical OpenAPI; keep normalization and error behavior explicit.

## Container runtime

Locally use Podman, never Docker, and drive it through the CLI: the integration test script provisions its disposable PostgreSQL container with `podman run`/`podman rm`, and runs the browser suite inside the official Playwright image (browser sandboxes work there even where host userns is restricted). CI provisions PostgreSQL as a GitHub Actions service container and passes `TEST_DATABASE_URL` to the same script, which then runs the browser suite on the host. Do not introduce Docker API clients or `DOCKER_HOST` configuration.
