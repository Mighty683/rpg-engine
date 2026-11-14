# Backend architecture hardening — multi-agent implementation plan

**Created:** 2026-11-14
**Status:** Waves 0–3 complete and reviewed; waves 4–6 not dispatched
**Acceptance:** [Handover](handover.md)

## Coordination and isolation

Use one coordinator and at most three concurrent implementation agents. Each numbered wave gets a fresh sub-agent, one per wave; waves 1–3 run concurrently after wave 0. Planning agents only inspected source and proposed boundaries.

- The coordinator owns task documentation, scope decisions, dependency requests, and the ownership ledger. It does not edit a worker's files while that worker is active.
- Ownership is by whole file, never by function or line range. A worker may read any file but writes only its assigned paths. New files must stay in an assigned namespace. Unlisted edits require an explicit coordinator transfer before work starts.
- A worker needing another owner's change sends the required signature/behavior and a proposed patch description. It does not apply the patch or fix another worker's compilation errors.
- No worker changes manifests, the lockfile, shared API fixtures, root lint configuration, or canonical OpenAPI unless its wave explicitly owns them. The coordinator queues those requests for an exclusive integration window; no dependency installation runs alongside another install.
- Preserve existing user changes, including the current uncommitted Ajv slice. Capture the starting diff before implementation. Never reset, clean, or revert files to manufacture a clean baseline.
- Use the shared workspace with disjoint files. Run focused read-only checks during parallel work; run broad formatting, generated-output commands, shared PostgreSQL suites, and full checks only at barriers. Use separate disposable databases if database tests must overlap.
- Delivery includes changed paths, contract impacts, commands/results, and unresolved issues. Ownership transfers only after the agent stops editing and the coordinator accepts the delivery.

## Sequence

```text
Wave 0: freeze shared contracts and extract helpers
                         |
            +------------+------------+
            |            |            |
      Wave 1 runtime  Wave 2 input  Wave 3 mapping
            |            |            |
            +------------+------------+
                         |
          Wave 4: module ownership and public services
                         |
          Wave 5: boundary enforcement and schema parity
                         |
          Wave 6: final integration verification
```

## Wave 0 — Foundation agent

Exclusive files: backend `src/shared/validation/**`, new `src/shared/http/**`, `src/types.ts`, module `types.ts` files, `modules/events/streams.ts` only for interface-compatible foundation adjustments, `modules/games/controller.ts`, `modules/auth/service.ts`, `modules/games/service.ts`, new `modules/auth/contract.ts` and `modules/games/contract.ts`, and directly affected adjacent tests. This wave may also update manifests/lockfile and `packages/tests/src/api/fixtures.ts` when needed; no other agent is active.

Work:

1. Preserve the existing Ajv slice and freeze compile/parse/error adapter signatures. Define distinct 400 envelope/identifier errors and 422 field errors, including multi-field validation support where current routes require it.
2. Extract `routeId` to shared HTTP code; retain a temporary export from the games controller until consumers migrate. Extract boundary credential/game validation into their owning contracts with temporary service re-exports. Do not duplicate rules or change authentication behavior.
3. Define explicit event publisher, revoker, stream-registration, and disposal capabilities. Keep an aggregate compatibility type for existing consumers. Freeze constructor options and capacity error behavior before runtime work.
4. Declare request/data types needed by waves 1–3 in their module `types.ts`; freeze them during parallel work. Keep character loader signatures stable, including `sheetSequential`.
5. Freeze runtime configuration/lifecycle decisions: proposed defaults are 8 connections per account, 256 total, a 15-second non-overlapping heartbeat, and a 10-second shutdown deadline. Inject small limits in tests. Reject capacity before headers with 429 `stream_capacity` and `Retry-After: 15`; disconnect slow consumers rather than queueing unbounded output. Disposal is idempotent, releases pending/active subscriptions, and prevents new registrations.
6. Preserve `createApp()` for existing callers; runtime may introduce a separate composition result exposing `{ app, dispose }` for the server entry point.

Gate: type-check and focused baseline tests pass; coordinator records the frozen signatures and releases the files below. No external HTTP behavior changes in this wave.

### Wave 0 delivery and frozen interfaces — 2026-11-14

The foundation agent delivered and stopped editing. Coordinator review accepted the gate; verification is recorded in the [handover](handover.md). Waves 1–3 have now also delivered and released their files. There are no active implementation owners. Wave 4 may receive its listed files on dispatch; remaining boundaries stay frozen.

| Boundary | Frozen contract |
| --- | --- |
| Schema compilation | `compileSchema<T>(schema, options?: { allErrors?: boolean }): SchemaValidator<T>`; first error by default, explicit multi-error collection when requested |
| Schema results | `checkSchema(validate, value, rootField)` returns a snapshot of `{ success: true, data }` or `{ success: false, issues: { field, message }[] }`; `parseSchema` retains the existing first-field application error; `invalidValue(field)` remains available |
| HTTP validation | `badRequest(message?)` and `parseEnvelope(validate, value, message?)` produce 400; `validationError(fields, message?)` and `parseFields(validate, value, rootField, messages?)` produce 422 field maps |
| Identifiers | `shared/http/route-id.ts` owns `routeId`; games controller retains a temporary export with the same behavior |
| Registration/game input | Owning `contract.ts` files now provide `validateCredentials` and `validateGame`; service compatibility exports remain; login parsing is untouched |
| Event capabilities | `GameEventPublisher`, `StreamRevoker`, `StreamRegistrar`, `StreamRegistration`; compatibility aggregate `GameEvents`; future managed capability `ManagedGameEvents` adds `EventLifecycle.dispose()` |
| Stream policy | `EventStreamOptions` has `maxConnectionsPerAccount`, `maxConnections`, `heartbeatIntervalMs`, and `retryAfterSeconds`; `defaultEventStreamOptions` is 8 / 256 / 15,000 / 15 |
| Runtime composition | Explicit `Configuration`; `ApplicationOptions = { eventStreams?: Partial<EventStreamOptions> }`; `ApplicationRuntime = { app: Express; dispose(): void }`; `ShutdownOptions = { timeoutMs?: number }`; default deadline 10,000 ms |
| Request/mapping types | Concrete auth/game, character, invitation, membership, NPC, and throw pagination inputs live in owning `types.ts`; character mapping receives `SheetCollections` and `EquipmentInsert`; update input uses existing `SheetChanges` |

`createGameEvents()` remains parameterless. Capacity enforcement, managed disposal, startup checks, and application lifecycle wiring are not implemented by this foundation delivery; wave 1 adds them using the declared contracts. No dependency or OpenAPI changes were needed for wave 0.

## Parallel waves — exclusive edit matrix

The 2026-11-14 dispatch also transferred `modules/auth/csrf.test.ts` and subsequently `modules/auth/guards.test.ts` exclusively to the runtime agent to update production-configuration fixtures. The coordinator owned `packages/tests/src/api/fixtures.ts` (application options and lifecycle cleanup) and canonical OpenAPI (SSE capacity/shutdown responses). These files were not edited by other workers. Integration tests used a coordinator-managed disposable PostgreSQL container on port 55432; shared database suites ran only at barriers. The container was removed after verification.

One explicit foundation amendment corrects the existing character update signature from shallow `Partial<FabulaSheet>` to the domain's `SheetChanges` (deep partial), matching existing merge behavior and the frozen request type. The mapping agent owns the workspace-service annotation; the coordinator exclusively owns the matching `modules/characters/factory.ts` annotation. No runtime behavior changes or casts are introduced by this amendment.

All source paths below are relative to `packages/backend/src/`. All three workers read the frozen types but do not edit them.

| Wave / agent | Exclusive production paths | Exclusive test paths | Work |
| --- | --- | --- | --- |
| **1 — Runtime** | `config.ts`, `app.ts`, `server.ts`; `modules/events/{controller,streams}.ts`; new `modules/events/heartbeat.ts`; new `lifecycle.ts` | `config.test.ts`, `app.security.test.ts`, `modules/events/{streams,heartbeat}.test.ts`, new `lifecycle.test.ts`; new `packages/tests/src/api/events-capacity.integration.test.ts` | Connection limits, pending-registration accounting, isolated slow/failed clients, heartbeat serialization, disposal/shutdown, startup configuration validation. Adopt shared identifier helper in the event controller. |
| **2 — Input validation** | `shared/validation/**`, `shared/http/**`; `modules/{auth,games,characters,throws,npcs,invitations}/controller.ts`; `modules/characters/party-controller.ts`; `modules/players/membership-controller.ts`; `modules/{auth,games,throws,npcs}/contract.ts`; existing/new `modules/{auth,games,characters,throws,npcs,players,invitations}/schema.ts` and new `modules/{characters,players,invitations}/contract.ts` | Adjacent contract/schema/shared-helper tests; new `packages/tests/src/api/request-validation.integration.test.ts` | Migrate request boundaries to compiled JSON Schema; preserve existing response/normalization policies; remove controller-to-controller helper imports except any explicitly scheduled compatibility cleanup. Supply named OpenAPI parity requirements to wave 5. |
| **3 — Character mapping** | `modules/characters/{service,party-service,workspace-service}.ts`; new `modules/characters/mapping.ts` | New `modules/characters/mapping.test.ts`, existing `modules/characters/characters.integration.test.ts`; new `packages/tests/src/api/character-projections.integration.test.ts` | Typed equipment conversion in both directions, shared sheet assembly, removal of positional arrays and `any` in mapping paths. Keep single and batched fetch strategies and all exported signatures stable. Do not restructure ownership workflows yet. |

**No overlaps:** runtime owns the event controller and composition; validation owns other controllers and schemas; mapping owns character persistence/assembly. No parallel worker edits existing module `types.ts`, factories, auth/game persistence services, Fabula rules, database schema/migrations, shared API fixtures, canonical OpenAPI, root configuration, or manifests. Needed changes are queued for an exclusive foundation amendment or wave 4/5, never improvised across boundaries.

Runtime configuration validation must reject bad production secrets/origin/port/proxy settings before listening while preserving intentional development defaults. If stricter startup settings require shared test-fixture changes, pause dependent execution for a coordinator-owned integration window; other workers continue independent work.

Validation must inventory each endpoint before migration: login malformed credentials remain 401; registration/game creation preserve 422 field maps; envelope/ID/revision failures retain 400 where applicable. Preserve permissive extra-key behavior where currently intentional, strict NPC/throws policies, pagination normalization, and partial character patch semantics. Character merged-sheet validation stays in the transaction and Fabula domain rules remain unchanged.

Wave gates: each worker runs focused tests and backend type-check against its delivery. The coordinator then runs the combined backend suite and sequential focused PostgreSQL checks. Do not release overlapping files to wave 4 until all three workers have stopped editing and failures are resolved.

### Parallel batch delivery — 2026-11-14

All three agents stopped editing. The coordinator accepted their combined delivery after 174 backend/lint tests, 43 PostgreSQL API tests, 9 backend PostgreSQL tests, backend type-check, and `pnpm check` passed. The real `pnpm dev` entry point served authenticated SSE and closed it on SIGTERM without reporting shutdown failure. Evidence and reviewed quality warnings are in the handover.

Wave 1 now implements the previously declared runtime policies: `createApplication(database, config?, options?)` returns the managed application; `createApp` remains compatible and accepts optional application options. Pending and active streams are counted, heartbeats are serialized, and startup/shutdown are validated. Wave 2 adds `compileObjectSchema` for staged envelope validation and exports schema components from the owning modules. Wave 3 provides `equipmentFromRow`, `equipmentToRow`, and `assembleSheet` while preserving query strategies and calculated-vs-override projection semantics.

Wave 5 must account for runtime/OpenAPI parity exceptions: password minimum uses UTF-16 code units and maximum uses UTF-8 bytes; login normalization retains authentication semantics; character schemas validate patch envelopes while merged-sheet rules remain transactional; throw validation uses sequential compiled components to preserve error precedence; NPC profile errors remain 422 while envelope/revision errors remain 400; query defaults/clamping remain explicit. Runtime JSON Schemas are still draft-07; OpenAPI is still 3.1.

## Wave 4 — Domain ownership agent

Starts after the parallel barrier. Exclusive ownership transfers to this agent for `app.ts`; module `{auth,games,characters,players,invitations,throws,npcs}/types.ts` and existing/new `factory.ts`; `modules/characters/workspace-service.ts`; `modules/players/membership.ts`; `modules/invitations/service.ts`; `modules/throws/{service,npc-resolve}.ts`; `modules/npcs/service.ts`; new owner-specific persistence/roll-reader files under the characters, players, invitations, and NPC modules; new `application/**` workflows. Own directly affected service tests plus new `packages/tests/src/api/architecture-ownership.integration.test.ts` and `roll-boundaries.integration.test.ts`.

- Replace factory-derived public service types with explicit capability interfaces and annotate factories against them. This wave also receives `modules/npcs/controller.ts` from the stopped validation worker: replace its direct `createNpcsService` type import and `ReturnType` dependency with the new `NpcsService` interface. Do not alter its delivered validation behavior.
- Put character ownership changes, membership changes, and invitation invalidation behind their owning module's transaction-bound operations. Application workflows coordinate ordering under the same transaction and game lock.
- Replace throw-service reads of character/NPC internals with authoritative transaction-bound reader interfaces. Preserve private-source checks, revisions, snapshots, and pure resolution functions.
- Retain narrowly documented cross-domain read projections where useful; do not mechanically wrap every SQL query or prohibit all joins.
- Preserve transaction atomicity and authorization rechecks; notify only after commit. Do not replace required atomic operations with asynchronous events.

The mapping worker has released `workspace-service.ts` before this wave. Runtime has released `app.ts`; validation does not continue editing contracts during this wave. Shared-fixture changes use a coordinator integration window.

## Wave 5 — Architecture enforcement and schema-parity agent

Exclusive files: new `lint/backend-boundaries.js` and its tests; `vite.config.ts`; `docs/spec/code-conventions.md`; `README.md`; `packages/backend/openapi/**`; new `packages/backend/src/schema-contract.test.ts`; shared schema-export tooling if needed; manifests/lockfile if approved. May remove temporary helper/service re-exports only through an explicit transfer of the affected file after all prior owners are idle.

- Enforce the final dependency policy: no controller-to-controller imports; consumers use declared public interfaces; flag disallowed sibling implementation dependencies. Document narrow read-projection exceptions and demonstrate the rule catches forbidden imports without rejecting valid composition.
- Do not claim an import rule alone detects foreign-table writes through the central database schema. Add a focused static check for supported write forms or retain an explicit review rule for cases it cannot prove.
- Add dialect-aware runtime/OpenAPI parity checks for migrated endpoints. The current runtime schema is draft-07 and OpenAPI is 3.1: array-form tuple `items` cannot be copied blindly. Compare the supported structural constraints or implement a tested export conversion. Document normalization, cross-field rules, and unsupported comparison cases explicitly.
- Update deployment guidance with startup requirements, stream policies, shutdown behavior, and the continuing single-process restriction.

Gate: boundary positive/negative fixtures, schema parity tests, lint, type-check, and OpenAPI lint/bundle pass. Intentionally change a fixture constraint to show the parity test detects drift; do not leave the fixture broken.

## Wave 6 — Verification agent

All implementation workers are idle. This fresh agent owns verification evidence in `handover.md` and shared test fixtures only when needed for integration. It runs the required checks below and reports failures to the coordinator; production fixes go back through explicit ownership transfer, followed by affected rechecks.

| Handover checks | Author / files | Dependencies | Execute |
| --- | --- | --- | --- |
| API-EVENT-01–03 | Wave 1; `events-capacity.integration.test.ts`; reuse existing security/session suites | Frozen events contract; runtime wiring; valid test configuration | Wave 1 delivery, combined barrier, wave 6 |
| API-VAL-01–04 | Wave 2; `request-validation.integration.test.ts` | Frozen HTTP policy; migrated validators; PostgreSQL fixture | Wave 2 delivery, combined barrier, wave 6 |
| API-MAP-01 | Wave 3; `character-projections.integration.test.ts` | Mapping extraction and existing character/party routes | Wave 3 delivery, combined barrier, wave 6 |
| API-DOM-01–03 | Wave 4; `architecture-ownership.integration.test.ts` | Owner operations; application wiring; test-only fault composition | Wave 4 delivery and wave 6 |
| API-DOM-04 | Wave 4; `roll-boundaries.integration.test.ts` | Authoritative readers; existing throw contracts | Wave 4 delivery and wave 6 |
| Existing browser journeys | Wave 6; existing suites, no new UI implementation | All backend waves integrated | Wave 6 |

Implementation-level checks are selected by their code owners: runtime fake-writer/backpressure and heartbeat concurrency tests; SIGTERM with an open stream, repeated shutdown and deadline fallback; invalid-config startup tests; schema adapter/normalization tests; equipment conversion/branch tests; factory interface type-checks; import-rule fixtures and schema-parity tests. These supplement the API-only handover check scope.

Final commands: `pnpm check`, `pnpm --filter @rpg-engine/backend build`, `pnpm test`, and `pnpm test:integration` with a disposable `TEST_DATABASE_URL`. The integration command covers backend database tests, adversarial API tests, and browser journeys. Investigate failures against the captured baseline; do not fix unrelated frontend work without authorization. Record exact tested revision/working-tree state and results. Missing database access leaves acceptance pending, not passed.

## Conditional follow-up — shared multi-process events

The coordinator tracks shared delivery/revocation as a separate task before deployment uses multiple backend processes. It needs its own topology, delivery/reconnect contract, and two-process revocation and missed-event recovery tests. Do not introduce a broker or promise durable delivery during this hardening task. Keep the single-process deployment restriction explicit until that follow-up is verified.
