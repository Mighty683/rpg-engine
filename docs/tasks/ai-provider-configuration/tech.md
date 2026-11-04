# AI provider configuration — technical clarification

**Created:** 2026-11-04  
**Status:** Proposed; not implemented.  
**Story:** [AI provider configuration](story.md)

## Scope and repository foundation

Use Mistral AI as the only initial provider, through its official SDK. Configuration is deployment-wide and supplied solely by backend environment variables, including a `.env` file. There is no application settings management, source precedence, or UI configuration persistence in this task. Environment changes require a backend restart.

`packages/frontend` is a Vue application with a placeholder root view. `packages/backend` contains Express, Arrow Express, PostgreSQL, and Drizzle dependencies but no server, source modules, schema, or AI SDK. Root development and build commands currently target only the frontend. No test runner is configured. Business modules belong under `src/modules`; Vitest is specified for unit and browser tests.

## Architecture

Place environment parsing and validation in `packages/backend/src/modules/ai-configuration`. Define the required Mistral credential and model variables, plus only additional settings supported by the selected SDK and actually needed for this integration. Load and validate configuration at startup; missing or invalid required input must produce an actionable sanitized error and never silently select another provider. Provide a placeholder-only environment example and ignore real secret-bearing `.env` files. Never expose secrets through `VITE_` variables.

Put an application-owned provider interface and domain request/result types in `packages/backend/src/modules/ai`. A Mistral adapter translates those types, provider failures, and requests to and from the official SDK. SDK types and errors do not leak into domain consumers. Keep the boundary small: do not build speculative adapters, a provider catalogue, gameplay tools, or an autonomous agent loop. Pin the SDK release and verify its real API and transport behavior before implementation.

A request uses a resolved configuration snapshot and a bounded text-generation operation. Set explicit timeout, bounded retries, and cancellation where supported. Normalize observable failures without returning raw upstream bodies or secrets. Do not silently fall back to another provider. Verification, if exposed, uses a synthetic minimal prompt, may incur charges, and proves only the tested text capability.

## Security and deployment

Provider traffic and credentials stay on the backend; do not enable SDK browser access. Redact credentials from responses, logs, and errors. Handle provider redirects safely and do not forward credentials to another destination. No login or operator-controlled network policy is planned in this task. The initial deployment must be restricted to a trusted environment; public or shared exposure requires appropriate access and outbound-request controls before deployment. Avoid adding arbitrary user-supplied endpoints or headers to the initial integration.

## Verification

- Test valid, missing, and invalid environment inputs, restart behavior, and sanitized configuration failures.
- Test the adapter against a controlled endpoint or transport: assert the model, request and result mapping, timeout/cancellation, credential rejection, rate limits, malformed responses, upstream errors, and redaction. Confirm no fallback.
- Test that SDK-specific types remain behind the adapter and that frontend responses and logs contain no credentials.
- Use Vitest input-driven unit cases and browser journeys in accordance with [testing conventions](../../spec/testing.md). Run an opt-in real Mistral smoke check before claiming real-provider compatibility; CI must not require paid credentials.
- Exercise a chat message through the frontend, backend and provider adapter for end-to-end acceptance. Text generation alone does not establish tool-calling or other capability support.

## Sources and limitations

The owner selected Mistral and its official SDK on 2026-11-04. No SDK release has yet been selected, installed, or tested in this repository; confirm the official SDK's current API and configuration behavior against the pinned release during implementation.
