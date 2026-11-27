# Technical decisions

## Backend deployment

Run one backend process, serving multiple users. Live events and connection revocation remain in memory. Multiple backend instances and shared event infrastructure are out of scope.

## Backend validation

The shared HTTP contract lives in [`@rpg-engine/api-schema`](../../packages/api-schema/openapi.yaml). Edit the OpenAPI document and run `pnpm api:generate` to refresh the checked-in `openapi-typescript` declarations. Import `ApiSchema` for named payloads or `operations` for endpoint-specific requests and responses. Keep database rows, normalized domain inputs, and UI drafts local to their modules.

Keep Express and validate request structure with JSON Schema compiled by Ajv. Keep schemas in their owning modules and reuse shared validation helpers. Authorization and domain invariants remain in services and transactions. Check structural parity with canonical OpenAPI; keep normalization and error behavior explicit.

## API errors and localization

The backend owns the HTTP status and reason for failure. It returns `{"error":{"code":"ERR01"}}` without a human-readable message. A code is stable **within an HTTP method and route template**: `ERR01` means invalid credentials on `POST /api/auth/login`, but an unavailable username on `POST /api/auth/register`. Never renumber a published code or reuse it for a different failure within the same operation.

Use `ERR01`–`ERR39` for operation failures, `ERR40`–`ERR79` for individual fields, and `ERR80`–`ERR99` for shared failures. A validation response can report several fields: `POST /api/games` can return HTTP 422 with `{"error":{"code":"ERR01","fields":{"name":"ERR40","systemId":"ERR42"}}`. Preserve field paths, documented conflict details such as `impact`, and headers such as `Retry-After`.

The frontend decodes each code against the failed operation first, then the shared mapping. It uses the decoded reason and HTTP status for recovery, and the [frontend error catalog](../../packages/frontend/src/shared/i18n/errors.en.json) for display. An unknown code or unreadable response gets a generic localized message; an unknown field code gets a localized invalid-value message. An authenticated `401` signals session expiry; public requests handle `401` locally. Retry a CSRF-rejected write once with a fresh token only when the `403` decodes to `invalid_csrf`.

When adding an error, update the [shared code registry](../../packages/api-schema/http-errors.ts), the operation’s `x-error-codes` in [OpenAPI](../../packages/api-schema/openapi.yaml), and the frontend catalog together. The contract test checks the published operation mappings against the registry.

## Container runtime

Locally use Podman, never Docker, and drive it through the CLI: the integration test script provisions its disposable PostgreSQL container with `podman run`/`podman rm`, and runs the browser suite inside the official Playwright image (browser sandboxes work there even where host userns is restricted). CI provisions PostgreSQL as a GitHub Actions service container and passes `TEST_DATABASE_URL` to the same script, which then runs the browser suite on the host. Do not introduce Docker API clients or `DOCKER_HOST` configuration.
