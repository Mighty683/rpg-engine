# OpenAPI and Swagger — technical design

**Created:** 2026-11-12

## Libraries

- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express) serves Swagger UI from Express.
- [Redocly CLI](https://redocly.com/docs/cli/guides/lint-and-bundle) validates and bundles the OpenAPI schema.

## Implementation

The [canonical OpenAPI 3.1 schema](../../../../packages/backend/openapi/openapi.yaml) covers the HTTP endpoints, request and response bodies, errors, session cookies, CSRF and the event stream. The schema is maintained explicitly because arrow-express routes do not supply complete schemas automatically.

The backend serves the bundled schema at `/openapi.json` and Swagger UI at `/api-docs/` in development mode. The backend dev command builds the bundle before startup. `pnpm check` lints and bundles the schema.

## Task workflow

Update the `task-tech` skill so every task that changes the API prepares a machine-readable OpenAPI schema for its proposed endpoints and links it from `tech.md`. During implementation, incorporate the approved changes into the canonical schema alongside the code. Tasks without API changes state that no schema change is needed.
