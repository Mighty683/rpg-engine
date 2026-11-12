# OpenAPI and Swagger — handover

- **API-01** Verify the OpenAPI 3.1 document covers the registered HTTP operations, request and response shapes, errors, session cookies, CSRF, and the event stream. Lint and bundle it through the repository checks.
- **API-02** Verify the schema and Swagger UI routes serve only in development. Check that the UI renders the schema under the existing Helmet policy and that the documentation routes are unavailable in production.
- **Workflow** Check that `task-tech` produces and links a machine-readable OpenAPI artifact for user review whenever a proposed task changes the HTTP API. Implementation incorporates the approved changes into the canonical document.

## Verification evidence

- **API-01** Compared the bundled OpenAPI paths and methods with the registered Express routes. All 37 operations match. Confirmed the session-cookie and CSRF schemes and the SSE response and event variants.
- **API-02** An isolated backend `pnpm dev` run bundled and served both documentation routes. Chromium rendered all 37 operations with the existing Helmet policy. Both routes returned 404 with `NODE_ENV` unset, in test, and in production.
- **Workflow** Both updated skills passed skill validation. `task-tech` requires an `openapi.yaml` linked from `tech.md` for user review. `task-implement` applies approved changes to the canonical schema.
- `pnpm check` passed, including zero-warning Redocly lint and bundling. The backend build passed. `pnpm test` passed all 88 tests with loopback access.
