# AI provider configuration — implementation plan

**Created:** 2026-11-04  
**Status:** Proposed; not implemented.  
**Inputs:** [Story](story.md) · [Technical clarification](tech.md) · [Minimal chat UI](ui.md) · [Code conventions](../../spec/code-conventions.md) · [Testing conventions](../../spec/testing.md)

## Scope and decisions

Use the official Mistral SDK as the only initial provider, behind an application-owned anti-corruption layer. Configuration is deployment-wide and environment-only; restart the backend to apply changes. There is no in-application provider management, provider selection, login, or operator-controlled network policy in this task. The initial deployment is restricted to a trusted environment; shared or public use requires security controls outside this scope.

Chat is the first application AI action and will be connected for text requests and responses, without tools or game actions. Retain a truthful disconnected state when the backend or configuration is unavailable. Sequence work serially; one implementation owner owns shared contracts and integration. Planning does not dispatch workers.

## Implementation sequence

### 1. Foundations and contracts

**Input:** Existing workspace, [tech.md](tech.md), and the connected text-chat requirement.  
**Work:** Define environment variable names, validation, domain request/result and sanitized failure contracts, and the small provider interface. Bootstrap the backend server and TypeScript/build scripts and frontend-to-backend development wiring needed for the agreed flow. Add Vitest unit and browser tooling. Select and pin the official Mistral SDK and verify its actual API and transport behavior. Ignore real `.env` files and provide a secret-free example.  
**Output/check:** Runnable backend/frontend/test commands, documented configuration and domain contracts, and no real credentials committed or exposed to frontend variables. Root development/build commands currently target only the frontend; document new commands.

### 2. Environment configuration

**Input:** Defined environment contract.  
**Work:** Build `packages/backend/src/modules/ai-configuration` to load and validate backend environment settings at startup and supply an immutable configuration snapshot. Document required credential and model, startup errors, trusted deployment and restart behavior.  
**Output/check:** Valid environment configuration works; missing or invalid required settings produce actionable sanitized errors and no provider fallback. Secrets never appear in ordinary responses, logs or errors.

### 3. Mistral adapter and AI action

**Input:** Configuration snapshot, pinned SDK and text-chat requirement.  
**Work:** Build `packages/backend/src/modules/ai` with domain-facing types and a Mistral adapter that translates requests, results and failures without leaking SDK types. Issue bounded text requests with explicit timeout, bounded retries and cancellation where supported. Handle redirects safely and redact upstream failures. If verification is exposed, use a minimal synthetic prompt and disclose potential charges. Wire the chat action; do not add speculative providers, tool execution or an agent loop.  
**Output/check:** A controlled endpoint or transport sees the intended model and request; mapped results and errors are sanitized, and no provider fallback occurs.

### 4. Chat shell and integration

**Input:** [ui.md](ui.md) and the backend chat contract.  
**Work:** Implement the bottom-right chat, including disconnected, ready, waiting and error states, draft preservation, safe text rendering and keyboard/focus behavior. Connect it to the backend text-chat action. Do not store credentials or conversations in the browser.  
**Output/check:** The shell fits the viewport and remains usable by keyboard; it never fabricates successful responses and remains truthful when disconnected.

### 5. Verify and document

**Input:** Completed implementation.  
**Work:** Add input-driven Vitest unit/integration cases and browser journeys without duplicating unit coverage. Cover valid, missing and invalid environment settings; restart; provider request/result mapping; rejected credentials, rate limits, malformed responses, timeout/cancellation, redirect handling and secret redaction. Exercise the chat accessibility and state journeys. Document setup, trusted-deployment limitation, restart, costs and capability limits.

**Completion checks:**

- Run `pnpm check`, `pnpm lint`, and `pnpm build`, plus newly established backend type/build and Vitest unit/integration/browser commands; record exact commands and results.
- Run with a controlled provider endpoint or transport in a trusted development environment. Exercise startup, failure handling, restart, and a chat message end to end; inspect requests and sanitized logs.
- Run an opt-in real Mistral smoke check before claiming real-provider compatibility; CI must not require paid credentials. Record unavailable checks; text success does not prove tool support.
- Review the [acceptance outcomes](story.md#acceptance-outcomes) against evidence and report unresolved decisions or failed checks.
