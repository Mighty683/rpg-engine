# AI provider configuration — implementation plan

**Created:** 2026-11-04  
**Status:** Blocked on decisions; not implemented.  
**Inputs:** [Story](story.md) · [Technical clarification](tech.md) · [Minimal chat UI](ui.md) · [Code conventions](../../spec/code-conventions.md) · [Testing conventions](../../spec/testing.md)

## Scope and gates

Deliver both independent configuration routes, a real bounded text request using the selected provider and model, understandable sanitized feedback, and the proposed minimal chat shell. The chat design does not define provider settings; agree its entry point, form, validation and secret-change interaction before implementing it. Do not treat the disconnected shell as completion of the provider story.

Before implementing shared contracts or exposing configuration, record decisions with the project owner:

1. Configuration scope, identities and management/verification permissions, and how those are enforced. There is no existing identity boundary; do not expose management operations to multiple users without one.
2. Source precedence, removal behavior, persistence, secret protection and key management. The whole-profile UI override over an environment baseline in [tech.md](tech.md#source-resolution-and-persistence) is a recommendation, not approval. Both routes must remain usable independently; never merge credentials into another source's endpoint.
3. Initial API modes and required capabilities, including whether OpenAI Responses or tool calling is needed. The recommended baseline is OpenAI Chat Completions and Anthropic Messages, text only. If tool calling is required, agree its contract and add a separate round-trip verification; do not invent game tools or an agent loop.
4. Operator-controlled egress policy, including explicitly permitted local/private destinations, DNS and redirects; deployment assumptions; and the actual application AI action used for acceptance. Agree whether chat is that action rather than assuming it.
5. Provider-settings UX and environment variable names, startup/reload behavior, storage/migration approach and operational recovery. Document the approved decisions and examples before implementation.

If these decisions cannot be made, stop at the relevant gate; a disconnected chat shell may be delivered independently but must not imply provider setup works. Sequence below is serial, with one implementation owner responsible for shared contracts and integration. Planning does not dispatch workers.

## Implementation sequence

### 1. Establish foundations and contracts

**Input:** Approved gates, existing workspace manifests and frontend shell.  
**Work:** Define the validated configuration, sanitized read and explicit secret keep/replace/clear write contracts, effective-source metadata, verification and error shapes, and request snapshot behavior. Define access and egress enforcement points before endpoint implementation. Bootstrap only the backend server, TypeScript/build and local frontend-to-backend development wiring needed for the agreed flow; add Vitest unit and browser tooling and package scripts. Pin the official SDK releases and verify their actual transport/auth behavior. Ignore real `.env` files while allowing a secret-free example.  
**Output/check:** Documented contracts and runnable backend/frontend/test commands; no real credentials committed or exposed to frontend variables. Existing root commands currently build and run only the frontend, so document any new package commands explicitly.

### 2. Implement configuration and security boundary

**Input:** Approved configuration, persistence, authorization and egress decisions; shared contracts.  
**Work:** Build `packages/backend/src/modules/ai-configuration` with one validator for environment and authorized UI input, source resolution, persistence and removal, sanitized reads, and immutable snapshots. Implement secret protection and approved migration/restart behavior. Explicitly confirm keeping a secret when changing destination. Enforce management permissions, URL/header validation and operator egress policy independently of user input; prevent credential forwarding on redirects. Add placeholder environment examples and operator instructions, including final URL examples and restart requirements.  
**Output/check:** Both sources work alone; precedence, invalid-source errors and removal follow the approved policy without silent fallback. Secrets never appear in read responses, ordinary logs or errors; unauthorized access and disallowed destinations fail closed.

### 3. Implement provider adapters and verification

**Input:** Validated snapshots, pinned SDKs and agreed API capabilities.  
**Work:** Build `packages/backend/src/modules/ai` adapters with explicit family selection, standard paths and narrowly scoped inference-path overrides. Map authentication and additional headers without SDK ambient defaults; `none` must send no credentials. Apply egress checks at connection time, safe redirect handling, bounded timeout/retries and cancellation. Normalize text results and observable failures without returning raw upstream bodies. Provide candidate verification with a synthetic bounded prompt, clearly indicating possible cost; it must not activate unsaved settings. Wire the agreed application AI action to a snapshot per request.  
**Output/check:** Controlled endpoints receive the intended method, URL, headers, model and body for each supported family; a configuration replacement affects later requests, not one already in flight. No automatic provider or API-mode fallback.

### 4. Implement settings and chat integration

**Input:** Approved settings UX, backend contracts and [ui.md](ui.md).  
**Work:** Implement `packages/frontend/src/modules/ai-settings` using backend-only calls, sanitized effective configuration/source, secret-present indicators and explicit secret operations. Show save, verification, permission and error states, including restart and precedence behavior. Implement the bottom-right chat shell with its disconnected, ready, waiting and error states; connect it only if the approved application action supports it. Preserve draft and session state, accessible keyboard/focus behavior and safe text rendering as specified. Do not persist credentials or conversations in browser storage.  
**Output/check:** A permitted user can independently set up, verify, replace and remove a UI profile; environment-only users can see the effective sanitized status. Chat never fabricates success, and its disconnected state remains truthful when integration is unavailable.

### 5. Integrate, verify and document

**Input:** Completed implementation and approved deployment policy.  
**Work:** Add input-driven Vitest unit/integration cases and browser journeys without duplicating unit cases. Cover the complete verification matrix in [tech.md](tech.md#verification-requirements): both families, URL prefixes and overrides, authentication modes and headers; source precedence, persistence/restart and in-flight replacement; denied access, egress/DNS/redirects and injection; ambient credentials, errors, cancellation, malformed responses and secret redaction. Exercise tool envelopes separately only if that capability is approved. Browser journeys cover both independent setup routes, verification, replacement, precedence and chat accessibility/state. Document setup, permitted destinations, compatibility limits, costs, secret handling, migration and recovery.

**Completion checks:**

- Run `pnpm check`, `pnpm lint`, and `pnpm build`, plus the newly established backend type/build and Vitest unit/integration/browser commands; record exact commands and results. Follow the project's branch-focused unit and user-journey browser conventions.
- Run the application with a controlled local provider under the approved development egress policy. Exercise environment-only startup, authorized UI-only setup, verification, replacement, removal, restart and the agreed AI action; inspect outbound requests and sanitized logs. Confirm an invalid active source fails without fallback.
- Run opt-in smoke checks with official and independently operated compatible services before making public compatibility claims; paid credentials are not required in CI. Record any unavailable checks and do not infer tool or other capability support from text success.
- Review every [story acceptance outcome](story.md#acceptance-outcomes) against evidence, including permissions and secret exposure. Report outstanding blockers or failed checks rather than marking the task complete.
