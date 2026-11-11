# OpenAPI and Swagger — technical design

**Created:** 2026-11-12

## Libraries

- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express) serves Swagger UI from Express.
- [Redocly CLI](https://redocly.com/docs/cli/guides/lint-and-bundle) validates and bundles the OpenAPI schema.

## Implementation

Write an OpenAPI 3.1 schema in `packages/backend/openapi/`, covering the existing HTTP endpoints, request and response bodies, errors, session cookies, CSRF and the event stream. The schema is maintained explicitly; arrow-express routes do not supply complete schemas automatically.

Serve the bundled schema and Swagger UI from development-only Express routes. Add schema validation to the repository checks. Keep existing application behavior and security middleware unchanged, and verify that the UI loads under the existing Helmet policy.

## Task workflow

Update the `task-tech` skill so every task that changes the API prepares a machine-readable OpenAPI schema for its proposed endpoints and links it from `tech.md`. During implementation, incorporate the approved changes into the canonical schema alongside the code. Tasks without API changes state that no schema change is needed.
