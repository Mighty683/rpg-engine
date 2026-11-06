# GM and player separation — implementation plan

**Created:** 2026-11-06

**Status:** Ready for implementation

Use the agreed behavior in the [UX journey](ux.md) and the contracts in the [technical design](tech.md). Reuse the reviewed layout and components from the [UI prototype](ui.md). Each wave ends with a working frontend and backend on a disposable database. Add and run the listed tests after integrating the wave.

The gallery still demonstrates a spent claim link and a blocked sibling link. Use the agreed lifecycle in production. A change of character control removes all links for that sheet. Use the UX spec for the username and password screens and permanent removal confirmation.

The ownership labels below are implementation roles. The integration owner maintains the shared HTTP and event contracts, Drizzle migrations and journal, application entry points, shared query and session wiring, and end-to-end test harness. Feature owners edit their listed modules. Agree on the relevant contract before backend and frontend work starts in parallel. The integration owner resolves cross-module changes and verifies each wave.

## Wave 1 — Signed-in GM workspace

A user can create an account, sign in, create a game as its GM, and create, open, edit, and activate sheets without adding players.

| Owner | Edit boundary | Work | Needs |
| --- | --- | --- | --- |
| Identity backend | Accounts and sessions | Implement registration, sign-in, sign-out and current account lookup. Enforce username uniqueness, password hashing, throttling and expiry. Issue the opaque session in an `HttpOnly`, `SameSite=Lax` cookie with `Secure` in production. Store the digest server-side. Own the session and origin guards and expose the typed actor to game services. | Identity contract |
| Game backend | Game access, character persistence and Fabula sheet service | Scope game lists to the actor and set the GM from the authenticated account. Own game access policy and locking. Move sheets to game-level IDs with optional membership control and an explicit GM active flag. Attach Arrow Express guards to game and sheet routes and recheck authority under the game lock before writes. Reuse sheet validation and revisions. Implement the GM roster, sheet creation and editing, and individual activation. | Actor and schema contracts |
| Account frontend | Account screens and auth API | Add username and password forms and session recovery. Connect registration, sign-in and sign-out to the shared session state. | Identity contract |
| Workspace frontend | Games, characters and their feature queries | Adapt `GamePicker`, `CreateGameScreen`, `GameRoster`, `CharacterPreview`, `CharacterSettings` and `CharacterControlTile` for persisted data. Use the shared `CharacterSheet`, existing sheet adapter and server-derived values. Open new inactive sheets in Characters management and keep active tabs on the main screen. | Game and sheet contracts |
| Integration | Schema, route registration and legacy route cutover | Apply the new schema in a disposable database. Register flat Arrow Express controller groups with explicit prefixes under `/api` and check the mounted methods and paths against the guard table. Scope protected queries by account and replace anonymous game and player-nested character routes in the same wave as their callers. | Integrated backend and frontend |

| End-of-wave verification | Acceptance |
| --- | --- |
| API and PostgreSQL | Verify cookie attributes, sign-out cookie clearing and server-side revocation. Reject duplicate normalized usernames, invalid or expired sessions, missing or mismatched write origins, and cross-game access. Check that guards reject requests before their route handlers run and that a forged account or role cannot affect ownership. Throttle repeated failed sign-ins. A game gets exactly one GM. A new GM sheet is inactive, multiple GM sheets can be active, and stale saves cannot overwrite newer revisions. Create retries produce one sheet. Legacy endpoints provide no anonymous access. |
| Browser and full stack | Register, create a Fabula Ultima game, open a newly created inactive sheet in management, edit it, activate it, and reload. Check saved fields and tabs. Sign out and verify protected data is cleared. |

## Wave 2 — Player membership and character control

A second account can join through a regular game link, read all sheets, and manage the sheets assigned to it. The GM can change control and remove or restore membership.

| Owner | Edit boundary | Work | Needs |
| --- | --- | --- | --- |
| Membership backend | Membership, player active slot, regular invitations and admission | Implement unique game membership and retain removed records to block re-entry. Allow players to select or clear their own active slot and the GM to manage any current player's slot. Derive a player's target from the caller's membership and validate a GM's target within the game. Use the GM guard for membership and reusable game link controls. Use the session guard for read-only preview and explicit acceptance so an eligible nonmember can join. | Wave 1 identity and games |
| Character backend | Sheet permissions, GM activation, reassignment and deletion | Attach member and sheet-control guards for all-member reads and controller-scoped edits and removal. Use the GM guard for assignment and takeback. Share the game transaction with the membership module so changes to active pointers and control commit together. Implement permanent removal with dependent cleanup and create replay protection after deletion. | Wave 1 sheets and agreed membership transaction contract |
| Settings frontend | GM membership and invitation views, regular invite acceptance | Reuse `MembershipPanel`, `InvitationManager` and `InvitationAcceptance`. Connect real link actions, sign-in resume, player removal and restoration, and unavailable link recovery. | Membership and regular invite contracts |
| Workspace frontend | Player roster, management and shared sheet presentation | Wire read-only sheets, player creation, active selection and **None**, expandable controller groups, and GM assignment. Add the named permanent removal confirmation for permitted accounts, including removal of an active sheet. | Character lifecycle contracts |
| Integration | Cross-module transactions and invite routing | Connect the protected invite resume route and shared transaction boundaries. Verify that permission checks and the resulting roster agree across the frontend and direct API. | Integrated membership and workspace |

| End-of-wave verification | Acceptance |
| --- | --- |
| API and PostgreSQL | Preview has no side effects. Regular join is repeatable without duplicate memberships. A removed account cannot rejoin by link. Restoration restores access only. All members can read inactive sheets. Only the GM or assigned player can edit or delete the sheet. The GM can select or clear a player's active character; other players cannot. Reassignment, membership removal and permanent removal clear the correct active slots. Verify that cross-game assignments fail and that a write denied by current state fails even if it passed the HTTP guard. A stale create retry cannot revive a deleted sheet. |
| Browser and full stack | Join as a second account, read an inactive sheet, create or receive a character, and switch or clear its active slot. Verify group expansion and read-only state. Confirm removal of an active assigned sheet by name and verify its disappearance. Exercise GM removal and restoration of the second account. |

## Wave 3 — Character invitations

The GM can share independent links for a character under GM control. A signed-in account can join and claim the sheet in one step, with an explicit activation choice.

| Owner | Edit boundary | Work | Needs |
| --- | --- | --- | --- |
| Invitation backend | Character links, preview and claim | Extend the invitation model for character links. Under the game lock, revalidate the link and controller, join if eligible, assign the sheet, apply the active choice, and remove all its links. Connect link cleanup to the shared control-change and deletion paths. | Wave 2 membership and control transactions |
| Invitation frontend | GM invitation settings and acceptance screens | Extend `InvitationManager` and `InvitationAcceptance` for character links. Keep **Make this character active** selected by default. Open an inactive claim in Characters management. Show recovery for URLs made unavailable by assignment, removal, rotation or a competing claim. | Claim and link contracts |
| Integration | Invite contracts, transaction wiring and fixture review | Verify that the application uses the same link lifecycle for direct assignment, claim, takeback and removal. Update the prototype review instructions when they differ from the agreed behavior. | Integrated character claim flow |

| End-of-wave verification | Acceptance |
| --- | --- |
| API and PostgreSQL | Two competing claims produce one winner. A failed claim leaves no new membership. An old link stays invalid after the sheet returns to GM control. Rotate or disable one link without affecting its siblings. Check that activation alone preserves links and that rotation or assignment racing with acceptance respects the committed state. |
| Browser and full stack | Resume a character invitation through sign-in. Claim as both a new and an existing member. Verify the default activation and the unchecked path, including preservation of an existing active character. Verify unavailable-link recovery and that removed members cannot claim. |

## Wave 4 — Live collaboration and release verification

Open game views reflect committed roster and sheet changes promptly. A second editor keeps their draft and can review the latest saved revision if edits conflict.

| Owner | Edit boundary | Work | Needs |
| --- | --- | --- | --- |
| Events backend | Game event subscriptions and publishing | Apply the game member guard to the same-origin SSE endpoint. Recheck session and game access before starting a pending stream. Publish roster and sheet invalidations after commit. Close streams on membership or session revocation. Add heartbeats and release subscriptions on disconnect. Keep writes on HTTP. | Waves 1–3 mutation and auth contracts |
| Live workspace frontend | Game subscription and sheet save recovery | Use one subscription per open game view, shared by the main game screen and Characters management. Refetch relevant queries on events and on connect or reconnect. Keep drafts tied to their base revision, prevent automatic replay after conflict or access loss, and update or exit open sheets when permissions change. | SSE event contract and Wave 2 workspace |
| Integration | Deployment proxy, release checks and two-account verification | Check streaming through the deployment proxy. Run the full verification commands below and compare production screens with the prototype on phone and desktop. Treat the UX and technical design as authoritative for production-only states. | Integrated live updates |

| End-of-wave verification | Acceptance |
| --- | --- |
| API and stream | An unauthorized account cannot subscribe. Committed roster and sheet writes emit hints, and rolled-back writes emit none. Revocation closes affected streams and blocks later reads and writes. Reconnect retrieves the current state even if events were missed. |
| Browser and full stack | In two signed-in browser contexts, observe active-tab changes, removal, and a saved sheet edit without a manual refresh. Preserve the second editor's local draft during a remote save. Verify conflict recovery and read-only or exit behavior when access changes. |
| Visual and keyboard | Compare the action row, horizontal tab scrolling, expandable controller groups, inactive sheet view and invitation settings against the prototype at phone width, the reviewed 811 px width and desktop. Check heading and modal focus, keyboard controls, status labels and disabled states. Verify the production-only sign-in, permanent removal and access recovery flows against the UX spec. |

## Release checks

- Run `pnpm check`, `pnpm --filter @rpg-engine/backend build`, `pnpm --filter @rpg-engine/frontend build`, and `pnpm --filter @rpg-engine/frontend prototypes:build`.
- Run `pnpm exec vp test`, `pnpm --filter @rpg-engine/frontend test:browser`, and `pnpm --filter @rpg-engine/tests test`. Use Chromium and set `TEST_DATABASE_URL` to a disposable PostgreSQL database with permission to create isolated schemas. Follow the repository's selector and test layout conventions. [Testing conventions](../../spec/testing.md) · [End-to-end guidance](../../../packages/tests/AGENTS.md)
- Verify migrations on a fresh database, including a second run of the migration command. The release assumes a fresh database. If existing game data must survive, settle how to establish GM ownership before rollout.
- Verify the production public origin, cookie settings, invitation encryption secret, and SSE streaming through the actual proxy. The first deployment can use a single backend process for event delivery. Multiple instances require shared event delivery before rollout.
