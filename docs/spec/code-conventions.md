# Code conventions

- Decompose code into small, reusable components and functions.
- Indentations are a sign of weakness, so keep your code flat and easy to read. Split code into reusable parts.
- Prefer SOLID and DRY designs where they improve clarity; do not introduce abstractions merely to satisfy a pattern.
- Use descriptive names for variables, functions, types, and classes. Names should state their purpose without forcing the reader to inspect the implementation.
- Document if needed public functions, types, classes, and non-obvious fields with their purpose, rationale, business context, and relevant design tradeoffs.
- Do not add line-by-line comments inside functions. The code itself must be clear enough to explain the mechanics.
- Start code files with a purpose and domain header when the language and repository conventions support it. Record consequential architectural decisions and relationships to other domain components which cannot be interpolated from code itself; do not add boilerplate headers where they would reduce clarity.
- We split code into business domain folders called modules placed in `src/modules`
- Reusable code elements of are exported to `src/shared` to be reused
- External API/SDKs should be wrapped in corruption layer so they are easy to replace

## Frontend component boundaries

- Keep type and interface declarations in the owning module’s `types.ts`, including types shared by components.

- View components receive data and callbacks through their interfaces and render the UI. They do not own application or domain logic and do not connect to the backend. Local presentation behavior, such as focus and opening a popover, may remain in a view.
- Controller components own application state and logic, coordinate domain operations and backend access, and supply data and callbacks to views. Keep backend details behind the appropriate application or API boundary.
- Keep component-specific styles with the component they style.

- Add stable `data-testid` attributes to UI elements targeted by browser tests.

## Backend dependencies

- Keep each backend module’s type and interface declarations in its `types.ts`; put shared infrastructure types in the corresponding `types.ts`.

- Assemble database-backed services in the application composition layer and inject them into controllers. Controllers must not receive the database or pass it to service calls.
- Inject configuration, event delivery, and the service dependencies required by authorization and event handlers through the same composition path.
- Bind transaction-scoped services to the current transaction so authorization and mutations share the same database context.

## Database query security

- Pass all data values to PostgreSQL as query parameters. Never concatenate or interpolate request data into SQL, including values that were validated earlier.
- Prefer Drizzle query builders and typed column objects. Build dynamic SQL options from explicit allow-lists; PostgreSQL parameters cannot represent identifiers. Use parameterized Drizzle `sql` templates for database-specific or complex queries.
- Avoid `sql.raw()`. Oxlint flags direct uses and rejects nonliteral query text in direct `.query(...)` calls in backend production TypeScript. These guardrails are not taint analysis: review indirect calls, migrations and generated SQL separately.
