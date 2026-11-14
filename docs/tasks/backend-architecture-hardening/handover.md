# Backend architecture hardening — handover

**Created:** 2026-11-14
**Status:** Waves 0–3 verified; domain ownership, architecture enforcement, and final verification pending
**Sources:** Backend architecture review and follow-up decisions in the planning chat; [code conventions](../../spec/code-conventions.md); [testing conventions](../../spec/testing.md); [API test guidance](../../../packages/tests/AGENTS.md).

## Acceptance goals

- Bound live-stream resource use, preserve private event delivery and revocation, and shut down with open SSE connections within a configured deadline.
- Reject invalid production configuration before opening the listener. Preserve intentional development behavior.
- Extend the existing Ajv validation pattern without changing endpoint status codes, normalization, field errors, authorization precedence, or unknown-field policies accidentally.
- Reuse typed character/equipment conversion and assembly without changing persisted values or projections.
- Expose explicit service capabilities and owner-provided persistence operations. Cross-domain workflows retain one transaction, current-state authorization, game locking, rollback, and after-commit notification.
- Enforce agreed import boundaries and detect runtime-schema/OpenAPI drift. Keep normalization and semantic checks explicitly separate from structural schemas.
- Preserve the single-process deployment requirement. Shared multi-process delivery is a separate conditional follow-up, not an acceptance requirement of this task.

## API integration checks

Tests belong in `packages/tests/src/api` and use a disposable PostgreSQL database. Assert response behavior and persisted effects. Ownership, dependencies, and execution waves are assigned in the [plan](plan.md).

| ID | Behavior and expected outcome |
| --- | --- |
| API-EVENT-01 | Per-account capacity applies across sessions; global capacity applies across games/accounts. Excess connections receive JSON 429 before SSE headers. Closing a connection releases capacity; other eligible accounts can connect below both limits. Rejected/unauthorized setup does not consume capacity or change persisted state. |
| API-EVENT-02 | Logout and membership removal close the relevant streams without closing unrelated streams. Subsequent forbidden reads/writes fail and rejected writes leave persisted state unchanged. Preserve registration-before-reauthorization race handling. |
| API-EVENT-03 | Private throw hints reach only author sessions in the same game; public hints retain existing audiences and contain no newly exposed domain data. |
| API-VAL-01 | Each migrated body, parameter, and query contract preserves its documented status/code/field response for malformed input and performs no writes. Strict endpoints continue to reject injected authoritative fields. Positive cases confirm legacy endpoints still accept/ignore extra keys where intentional, without persisting those keys. Reject unintended type coercion while preserving explicit query-normalization exceptions. |
| API-VAL-02 | Login keeps malformed-credential 401 behavior; registration retains 422 field maps and password byte limits. Origin, CSRF, duplicate-account handling, and authentication/authorization precedence remain intact; rejected requests create no account/session records. |
| API-VAL-03 | Accepted Unicode names, normalized IDs, optional/null fields, partial character patches, and all roll setup variants persist/return equivalent values. Preserve throws pagination defaults and clamping. Malformed roll requests create no history. |
| API-VAL-04 | Schema acceptance does not bypass stale-revision, ownership, or membership-revocation checks inside mutations. Rejected writes leave all affected tables unchanged. |
| API-MAP-01 | Save every equipment variant, then read the character sheet and active-party projection. Shared defenses, maxima, resources, and weapon fields agree; reads do not alter persisted equipment. Preserve ordering and null/override behavior. |
| API-DOM-01 | Player removal atomically clears active selection, releases characters, invalidates character invitations, and denies subsequent member access. GM ownership transfer clears the former selection and invalidates links. Unauthorized attempts and unrelated games remain unchanged. |
| API-DOM-02 | Concurrent acceptance of one character invitation results in one owner, no duplicate membership, and consistent active selection, preserving existing response semantics. |
| API-DOM-03 | A controlled failure after an early workflow mutation rolls back membership, character, and invitation changes and emits no success notification. Test fault injection stays in test composition; no public fault endpoint. |
| API-DOM-04 | Roll readers reject forged/cross-game IDs, stale revisions, inactive characters, and unauthorized private sources without inserting throws. Valid character/NPC rolls retain authoritative snapshots. |

## Browser coverage

No new UI flow is introduced. Run the existing browser journeys for game management, character control, invitations/live collaboration, and NPCs as regression coverage after integration. Do not duplicate API adversarial cases in new browser scenarios.

## Verification evidence

The preceding NPC Ajv slice passed 109 selected backend/lint tests, backend type-check, focused lint, and OpenAPI validation on 2026-11-14. That is baseline evidence only. The wave-specific evidence below records subsequent verification; API-EVENT-01–03, API-VAL-01–04, and API-MAP-01 now pass. API-DOM-01–04, architecture/schema parity enforcement, and final browser regression remain pending.

Record the tested revision, commands, results, failures, and remaining work here after each delivery. Do not mark the task Implemented or archive it until acceptance is verified.

### Wave 0 — foundation, 2026-11-14

Verified the uncommitted delivery on base revision `d30ea8b945daf23cb988a862f9915cebb4cc0a42`, preserving the pre-existing NPC Ajv slice. Starting snapshots are `/tmp/backend-hardening-wave0-start.patch` and `/tmp/backend-hardening-wave0-start.status`; agent snapshots are `/tmp/backend-wave0-baseline.diff` and `/tmp/backend-wave0-status.txt`.

- `pnpm exec vp test --run packages/backend/src lint --exclude '**/*.integration.test.ts' --exclude '**/migrations.test.ts'`: 121 tests passed in 20 files. A final focused HTTP-helper follow-up passed 7 tests after its last adjustment.
- `pnpm --filter @rpg-engine/backend build`: passed, including after the final source edit.
- `pnpm exec vp lint` and `pnpm exec vp fmt` on the wave's changed/new source and test files: passed; final HTTP helper lint passed.
- `pnpm --filter @rpg-engine/backend openapi:lint`: passed. Extraction and added internal contracts did not change HTTP schemas, so canonical OpenAPI required no edit.
- `git diff --check`: passed. Ripwire edit checks reported no incompatible callers; quality delta reported zero gating regressions. Existing NPC normalization duplication and minor churn/lockfile verbosity were not introduced as new task blockers.
- Coordinator reviewed extraction parity, unchanged login parsing and loader signatures, compatibility exports, shared validation behavior, and event/runtime interface ownership. No further source changes were required by review.

At the wave 0 delivery, only the foundation gate was complete. `TEST_DATABASE_URL` was unset; no PostgreSQL API/database suites or browser integration journeys ran for that delivery. All API acceptance checks were pending, and runtime policies were declared contracts only. The later batch evidence below supersedes that status.

### Waves 1–3 — parallel delivery, 2026-11-14

Verified the uncommitted combined delivery on base revision `d30ea8b945daf23cb988a862f9915cebb4cc0a42`. Starting tracked diff: `/tmp/backend-hardening-parallel-start.patch`. Each worker retained exclusive file ownership; coordinator amendments covered fixture lifecycle/options, SSE OpenAPI responses, the character factory's `SheetChanges` annotation, and the runtime worker's two production-config test fixtures.

The test environment file existed, but its PostgreSQL service was stopped. Rather than alter the development service, the coordinator started a separate `postgres:17` container named `rpg-engine-hardening-test`, exposed only on localhost port 55432, with database `rpg_engine_test`. Tests used isolated schemas. The disposable container was stopped and removed after verification; no development database was changed.

| Check | Result |
| --- | --- |
| `pnpm exec vp test --run packages/backend/src lint --exclude '**/*.integration.test.ts' --exclude '**/migrations.test.ts'` | 174 tests passed in 27 files |
| `pnpm --filter @rpg-engine/tests test:api --run` with the disposable `TEST_DATABASE_URL` | 43 tests passed in 12 files, including all new API-EVENT, API-VAL, and API-MAP checks |
| `pnpm exec vp test --run packages/backend/src/migrations.test.ts packages/backend/src/modules/auth/sessions.integration.test.ts packages/backend/src/modules/players/active-selection.integration.test.ts packages/backend/src/modules/characters/characters.integration.test.ts` with the disposable database | 9 tests passed in 4 files |
| `pnpm --filter @rpg-engine/backend build` | Passed |
| Focused backend/new API-test lint | Passed |
| `pnpm check` | Passed formatting, lint, type checks, OpenAPI lint, and OpenAPI bundle |
| Actual `pnpm dev` startup and SIGTERM smoke (`/tmp/rpg-hardening-dev-smoke.mjs`) | Started on an isolated port/schema; authenticated SSE returned 200 and connected; SSE ended on process-group SIGTERM; parent process exited by SIGTERM with no backend shutdown error reported |
| `git diff --check` | Passed |

Worker checks additionally covered 31 runtime tests, 84 focused validation tests, 11 mapper/Fabula tests, and a 949-input old/new throw-parser differential probe with zero output/error mismatches. Counts overlap the combined suite and are not additive.

Failures resolved during integration:

- A real open-SSE lifecycle test exposed keep-alive connections delaying drain. Shutdown now closes connections that become idle as responses finish; the regression passes.
- The old origin-guard production fixture lacked the newly required secrets. Valid test secrets were added without weakening startup checks; all 3 focused guard tests and the combined suite pass.
- The new projection test incorrectly expected override maxima in the party's calculated-maxima field. Existing `preview()` behavior was confirmed; the test now verifies calculated projection values and separately retained sheet overrides. No production rules were changed. The focused PostgreSQL projection test and full API suite pass.
- Repository checking found one formatting issue in the mapping persistence helper; formatting-only correction applied and `pnpm check` rerun successfully.

Coordinator reviewed the runtime lifecycle/resource behavior, schema compatibility, shared fixture integration, and character mapping diff. Static edit checks reported no incompatible callers in coordinator-owned changes. The mapper's raw-function arity flag was inspected: its factory supplies the dependency argument, so the bound controller call is valid.

The quality scan is **not clean**: it reports modification-frequency warnings, increased event-factory aggregate complexity (14 to 24), OpenAPI response-description growth, small parser-wrapper duplication, and deliberate transport-error isolation. These were reviewed; transport branches are covered by targeted tests, the factory keeps shared subscription state together, and the additional OpenAPI responses describe new behavior. No quality-warning suppression was added. Further architecture enforcement and consolidation belong to waves 4–5; this evidence does not claim zero static findings.

API-EVENT-01–03, API-VAL-01–04, and API-MAP-01 are verified for this delivery. API-DOM-01–04 remain pending the ownership refactor and its dedicated tests. The existing browser regression suite and final end-to-end task gate remain scheduled for wave 6. Waves 4–6 have not been dispatched; the task is not Implemented or archived.
