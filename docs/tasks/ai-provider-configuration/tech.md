# AI provider configuration — technical clarification

**Created:** 2026-11-04  
**Status:** Requirements clarified; technical recommendations below are not implemented.  
**Story:** [AI provider configuration](story.md)

## Confirmed requirement

Configure connections by API compatibility, not provider brand. Both the in-game UI and backend `.env` configuration must support choosing an OpenAI or Anthropic SDK family, the service endpoint/path, authentication, and model. A compatible third-party or local service must not need a dedicated provider integration or an entry in a provider catalogue.

This is a reasonable interoperability strategy, not a guarantee that every AI service works. Endpoint and authentication changes cannot translate an incompatible request schema, response schema, streaming format, or tool-calling protocol.

## Repository findings

- `packages/frontend` is a Vue application with a placeholder root view. No settings or AI modules exist.
- `packages/backend` has Express, Arrow Express, PostgreSQL, and Drizzle dependencies, but no server, source modules, schema, persistence, or AI SDK dependencies.
- Root development/build commands currently target only the frontend. No test runner is configured in either package.
- [Code conventions](../../spec/code-conventions.md) require business modules under `src/modules`; [testing conventions](../../spec/testing.md) specify Vitest for unit and browser tests.
- `.gitignore` does not currently exclude `.env` files. Implementation must exclude real secret-bearing environment files and provide only a placeholder example.

## Compatibility boundary

Use the official backend TypeScript packages `openai` and `@anthropic-ai/sdk`, behind a small application-owned adapter boundary. Users select a compatibility family, not an npm package or executable code.

Recommended initial API contracts:

| Family | SDK operation | Standard request path |
| --- | --- | --- |
| OpenAI-compatible | `client.chat.completions.create` | `/chat/completions`, relative to a base URL commonly ending in `/v1` |
| Anthropic-compatible | `client.messages.create` | `/v1/messages`, relative to the configured base URL |

OpenAI Responses (`client.responses.create`, `/responses`) is a different contract, even though it uses the same SDK. Do not treat a Chat Completions endpoint as a Responses endpoint. Supporting Responses-only services requires an explicit additional API mode and adapter mapping; whether to include it in this task remains a scope decision.

Baseline verification is a real, bounded text-generation request using the selected model. Model-list endpoints are not universally available and must not be mandatory; model identifiers must be enterable directly. A successful text request does not prove streaming, tool calling, structured output, image, or audio support.

For application tool use, compatibility includes receiving a tool call with its identifier/name/arguments and returning the corresponding tool result to the model. The two protocols represent these differently. Keep translation inside the adapters; validate tool arguments and authorize execution in the application, not in the SDK. This task must not invent gameplay tools or an autonomous agent loop. Tool support needs a separate contract check before the application relies on it.

## Configuration contract

Both setup routes feed the same validated server-side configuration shape:

| Field | Meaning |
| --- | --- |
| API family | OpenAI-compatible or Anthropic-compatible; never guessed from hostname or model name. |
| Base URL | Absolute service URL including any gateway/version prefix. Standard operation paths are appended according to the chosen adapter. |
| Request path override | Optional replacement for that adapter's inference path, for gateways using a nonstandard route. This changes routing only, not the API schema. |
| Model | Opaque, nonempty service model/deployment identifier; no fixed model catalogue. |
| Authentication | Explicit `bearer`, `header`, or `none`. Bearer uses `Authorization: Bearer <secret>`; header uses a configured header name and secret value; none sends no credentials. |
| Additional headers | Optional gateway/protocol headers, treated as potentially secret. They cannot override transport headers or conflict with the selected authentication mode. |

Keep base URL and operation path distinct to avoid duplicated `/v1` or appended `/chat/completions` after a full endpoint. A path override must remain on the configured origin, contain no query/fragment, and preserve the base URL prefix. Document an example of the final request URL for each family. Do not offer arbitrary HTTP methods or request-body templates.

Both SDKs expose `baseURL` and header/fetch customization. Use normal SDK options for standard routes; if a nonstandard inference path needs a transport wrapper, restrict rewriting to the exact inference operation. Do not rewrite unrelated SDK operations. Verify final URL and headers against the pinned SDK releases before implementation claims compatibility.

Authentication is independent of API family: an OpenAI-shaped gateway may require a custom key header; an Anthropic-shaped gateway may require a bearer token. Protocol/version headers remain the adapter's responsibility, with validated explicit overrides where necessary. `none` must suppress SDK-generated authentication and ambient credential discovery, not send a dummy key. Never allow unrelated SDK environment defaults to inject credentials, endpoint, organization, or project settings into a resolved application configuration.

Interactive OAuth login, automatic token refresh, cloud request signing, and client certificates are not covered by static authorization settings. Such services need a compatible gateway or a separate integration; do not label them supported merely because their model payload resembles one of these APIs.

## Responsibilities and data flow

Proposed module boundaries, not existing files:

- `packages/frontend/src/modules/ai-settings`: collect configuration, submit secret changes, and show sanitized effective settings/source and verification results. No SDK clients, provider calls, or persistent browser credential storage.
- `packages/backend/src/modules/ai-configuration`: parse environment input and UI updates through one validator, enforce access, resolve the effective configuration, persist UI settings using the agreed storage policy, and return redacted metadata.
- `packages/backend/src/modules/ai`: construct the selected SDK adapter from a resolved configuration snapshot, issue bounded requests, normalize results/tool envelopes and failures, and redact diagnostics. It must not decide who can change settings or execute game tools.

Flow: backend environment input or authorized UI update → validation and source resolution → immutable effective configuration → SDK adapter → configured endpoint → normalized result or sanitized failure. Each request retains its starting configuration; later requests use a successfully applied replacement. Verification of an unsaved candidate must not silently activate it.

The frontend talks only to the application backend. Read contracts never return saved secrets; write contracts distinguish keeping, replacing, and clearing a secret. Keeping a secret when changing endpoint must require explicit confirmation rather than automatically forwarding old credentials to a new destination. A secret-present indicator is not a placeholder secret to write back.

## Source resolution and persistence

Recommended policy, pending approval: backend `.env` values form one complete baseline profile; a saved UI profile replaces it as a whole. Do not merge individual fields across sources, which could send an environment credential to a UI-selected host. Removing the UI profile restores the environment baseline. An invalid active source produces an actionable configuration error, not a silent fallback.

Recommended UI persistence is across backend restarts; environment edits take effect after backend restart, UI changes after a successful save. Storage technology, secret protection/key management, and exact environment variable names are not settled. Do not have the browser edit `.env`, and never expose secrets through `VITE_` variables.

## Security and operational invariants

- All provider traffic and credentials stay on the backend. SDK browser-enabling flags are forbidden.
- Configuration read/write/verify operations require the agreed management permission. Existing code has no identity or authorization boundary; multi-user exposure is blocked until that boundary exists.
- Custom URLs make this an outbound-request/SSRF boundary. Restrict schemes to HTTP(S), reject URL userinfo and secret-bearing query parameters, and do not forward credentials through redirects. Require HTTPS except for explicitly authorized local/private development endpoints.
- An operator-controlled egress policy must govern destinations independently of UI-supplied URLs, including DNS resolution and redirect handling. Supporting a local AI server is deliberate, not a reason to allow arbitrary internal network access to every user. `localhost` refers to the backend host/container, not the browser device.
- Validate header names/values, reject CR/LF and routing/transport overrides, and prevent duplicate/conflicting authentication headers. Redact custom secret headers as well as standard ones; do not expose raw upstream error bodies or SDK debug output.
- Set explicit timeouts and bounded retries for verification and normal calls rather than accepting SDK defaults. Cancellation must reach the provider request. A retry must never re-execute an application tool action.
- Report invalid configuration, authentication rejection, missing route/model, protocol mismatch, rate limiting, timeout/network failure, and upstream failure distinctly where observable. No automatic provider or API-mode fallback.
- Verification sends a synthetic minimal prompt, not game data, and may incur provider charges. Its result applies to the tested configuration/model/capability, not all features or future requests.

## Verification requirements

Follow the repository's Vitest conventions: input-driven unit cases with multiple related assertions, plus browser journeys without duplicating unit coverage. No tests exist for this feature yet.

- Cover both families with standard URLs, version/gateway prefixes, trailing slashes, explicit path overrides, opaque model IDs, each auth mode, and additional headers. Assert actual outbound method, full URL, headers, body, and result mapping using a controlled HTTP endpoint.
- Cover environment-only, UI-only, both present, override removal, invalid sources, secret keep/replace/clear, endpoint changes, persistence/restart, and configuration changes during an in-flight request.
- Cover credential rejection, wrong route/model, incompatible successful HTTP response, rate limits, timeout/cancellation, malformed tool envelopes, and secret-bearing upstream errors. Assert sanitized results and no silent fallback.
- Cover outbound destination policy, redirects, header injection/conflicts, absent-auth mode with ambient SDK credentials present, and denied access. Assert that secrets are absent from read responses and logs.
- Browser journeys demonstrate independent UI setup and environment-backed setup visibility, verification feedback, provider replacement, and the agreed source-precedence behavior.
- Run opt-in smoke checks against official services and independently operated compatible endpoints before making public compatibility claims. CI must not require paid credentials. Test tool-call/result round trips separately when tool support is required; text success alone is insufficient.

## Decisions still required

1. Is configuration deployment-wide, per game, or per user, and who can manage or verify it? Deployment-wide, management-only access is the simplest proposal, not a confirmed requirement.
2. Approve or change whole-profile UI-over-environment precedence, UI persistence across restarts, and the associated secret storage policy.
3. Are Chat Completions and Anthropic Messages sufficient initially, or must OpenAI Responses be included? Which capabilities beyond text, particularly tool calling, are mandatory for the first consumer?
4. Choose the deployment/egress policy for local/private endpoints and the application AI action used for end-to-end acceptance. Neither currently exists.

These are implementation blockers, not reasons to replace the confirmed protocol-based requirement with a provider whitelist. Backend bootstrapping, persistence, authorization, and test tooling are affected foundations; sequencing belongs in the implementation plan.

## Sources and limitations

Reviewed 2026-11-04:

- [OpenAI Node SDK README](https://github.com/openai/openai-node/blob/master/README.md): distinct Chat Completions and Responses APIs, configurable transport, timeouts/retries, and server-side credential guidance.
- [OpenAI SDK client options](https://github.com/openai/openai-node/blob/master/src/client.ts): base URL, headers, authentication, and ambient environment behavior.
- [Anthropic TypeScript SDK README](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md) and [client options](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/client.ts): Messages API, base URL, authentication/header customization, and server-side usage.

These upstream branches are mutable. No SDK release has been selected, installed, or tested in this repository. Their extension points support the proposed direction; they do not establish compatibility with every gateway or model.
