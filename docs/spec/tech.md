# Technical decisions

## Backend deployment

Run one backend process, serving multiple users. Live events and connection revocation remain in memory. Multiple backend instances and shared event infrastructure are out of scope.

## Backend validation

Keep Express and validate request structure with JSON Schema compiled by Ajv. Keep schemas in their owning modules and reuse shared validation helpers. Authorization and domain invariants remain in services and transactions. Check structural parity with canonical OpenAPI; keep normalization and error behavior explicit.
