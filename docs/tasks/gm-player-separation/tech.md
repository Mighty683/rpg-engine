# GM and player separation — technical design

**Created:** 2026-11-06

**Status:** Ready for implementation

## Current situation

The [game API](../../../packages/backend/src/modules/games/controller.ts) lists supported games without an account or owner. The [player controller](../../../packages/backend/src/modules/players/controller.ts) creates named records inside a game and also serves character routes. Its checks validate IDs and parentage; they do not establish who is making the request. [Vue Router](../../../packages/frontend/src/main.ts) mirrors this hierarchy: games → players → sheets.

[Players](../../../packages/backend/drizzle/002_players.sql) hold a revision and one active character pointer. [Characters](../../../packages/backend/drizzle/003_characters.sql) have a required player foreign key with cascading deletion and belong to a game through that player. This cannot represent a GM-controlled sheet without a player record. The [character service](../../../packages/backend/src/modules/characters/service.ts) already has transactional sheet persistence and revision checks. Its list function loads sheet children per character; the workspace needs a summary query and a separate sheet fetch.

The [UX journey](ux.md) defines accounts, game roles, invitations and game ownership of characters. Use the [UI prototype](ui.md) as the visual baseline and follow the UX journey for sheet access, active character controls and release scope.

## Decision record

| Decision | Reason |
| --- | --- |
| Use local username and password accounts. | Registration and sign-in need no identity provider or email service. |
| Resolve account identity on the server and role separately in each game. | The same account can GM one game and play in another. A route ID, form value or visible control cannot grant access. |
| Use Arrow Express controller handlers as HTTP guards and share the authorization rules with services. | Requests are rejected before route handlers run. Services check current ownership and membership before accessing data or changing state. |
| A game owns each sheet. A player membership can control it. | Reassignment, removal and restoration preserve the sheet in its game. A GM can create and use sheets with no player accounts. |
| Active status controls workspace tabs. | Every current member can read every full sheet. Sheet editing depends on control and role. |
| Notify open game views with server-sent events (SSE). | Roster changes and saved sheet edits should appear promptly for everyone viewing them. The browser uses HTTP for writes. |
| A sheet can be made inactive or permanently removed. | Deactivation preserves the sheet in Characters management. Permanent removal ends the sheet's lifecycle. |
| Keep invitation preview and acceptance separate. | Opening or prefetching a link must have no side effects. Explicit acceptance is where membership and any claim change. |
| Keep the existing Fabula Ultima sheet and save contract. | This task changes access and character control. Manual sheet defaults, validation and derived values remain in the [Fabula rules module](../../../packages/backend/src/modules/fabula/rules.ts); no new RPG rules are needed. |

## Implementation specification

### Identity and authority

Introduce an auth module at the [Express application boundary](../../../packages/backend/src/app.ts) for registration, sign-in, sign-out and current account lookup. Store an immutable account ID, a username and a password hash in PostgreSQL. Enforce username uniqueness in the database with the same case-insensitive normalization used at sign-in. Use the account ID for game ownership and membership. This release has no identity provider, email field, email verification or self-service password reset.

Store only salted password hashes produced by a dedicated password-hashing library. Rate-limit failed sign-in attempts and return the same error for an unknown username and a wrong password. See [NIST password guidance](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/) for storage and throttling. Resolve the current account for the frontend without returning credentials.

Issue an opaque session token in an `HttpOnly` cookie after successful registration or sign-in. Set `SameSite=Lax` so a signed-in user can open an invitation from another site, and set `Secure` in production over HTTPS. The cookie is the browser's only storage for the session token. Same-origin API requests and SSE use it automatically. Store the token digest and session expiry on the server. On sign-out, invalidate the session and clear the cookie. Verify the configured origin on writes. Keep the existing same-origin frontend and `/api` proxy and serve SPA deep links through the frontend fallback.

Store one required `gm_account_id` foreign key on each game. Set it from the authenticated account on creation and keep it fixed for this release. Store player memberships with a unique `(game_id, account_id)` and an explicit current or removed state. Resolve the GM role from the game row and the player role from a current membership in that game. The GM does not need a player membership in their own game. Keep removed records so invitations cannot restore them. List only games where the account is GM or a current player and return its role for each game.

| Operation | Authorization |
| --- | --- |
| Read game and roster summaries | GM and current players; expose only the display fields needed for the roster. |
| Read full sheets | GM and current players can read all sheets. The workspace shows active sheets. Characters management also opens inactive sheets. |
| Create or edit a sheet | GM can create under GM control and edit any sheet. Players create under their own membership and edit only sheets they control. |
| Change active status | A current player can select an assigned character or clear their own active slot. The GM can make individual GM-controlled characters active or inactive. Players alone set their own active selection. Changes in control or membership can clear it. |
| Permanently remove a sheet | The GM can remove any sheet in the game. A current player can remove a sheet assigned to them. |
| Assign or take back a sheet; remove or restore a player; manage links | GM of that game only. Assignment targets must be current players in the same game. |
| Preview or accept an invitation | Signed-in account with a valid token for that operation. Preview exposes only the game and, for a character link, the character name. Removed accounts cannot join or claim. |

### Arrow Express guards

Use the pinned Arrow Express 4.0.0 [controller handler API](https://www.npmjs.com/package/arrow-express/v/4.0.0). Register each guard with `Controller().handler(guard)`. Arrow Express awaits it before invoking `Route().handler((request, response, context) => …)` and passes along the context it returned. Throw `RequestError` with the existing `{ error: { code, message } }` envelope to stop the chain. Register protected groups directly on `Application().prefix("api")` with explicit relative prefixes such as `games/:gameId/characters`. In the pinned version, nesting controllers can drop the application and ancestor prefixes. Compose checks inside each group's single controller handler and verify the final method and path in the assembled app.

| Controller group | Checks before the route handler |
| --- | --- |
| Registration and sign-in | Require the configured application origin on POSTs. The auth service handles credentials and sign-in throttling. The read-only system catalog stays public. |
| Current account, sign-out and game list or creation | Resolve the session cookie into an authenticated actor. Require the configured origin on writes. The game list service filters by that actor, and creation sets the GM to that actor. |
| Game details, roster, sheet reads and creation, and SSE | Resolve the actor, validate the game ID and require the GM or a current player of that game. On writes check the origin before game lookup. Scope sheet lookup to that game. Sheet creation derives its controller from the caller's role and membership. |
| Sheet edits and permanent removal | Apply the game member checks, resolve the sheet within the game and require its assigned current player or the GM. |
| Player active selection | Apply the game member checks and derive the target membership from the caller. Require the player role. The service checks that any selected sheet is assigned to that membership. |
| GM settings, assignment, takeback, membership removal and restoration, link management and GM sheet activation | Apply the game member checks, then require the GM role. The service checks action-specific targets in the game. GM activation applies only to GM-controlled sheets. |
| Invitation preview and acceptance | Resolve the actor and check the origin on acceptance. The invite service resolves the game from the token and checks eligibility. These endpoints allow eligible signed-in accounts before they have game membership. |

The session guard returns a typed actor with `accountId` and the server-side `sessionId` for sign-out and SSE revocation. Game guards add `gameId` and the resolved role, including `membershipId` for players. A sheet guard may add the verified `characterId`. Treat client-supplied IDs as selectors. Derive the actor, role and self-service membership from server state. Reject writes with a missing or mismatched `Origin` on the browser endpoints above. Use `401` for missing, expired or revoked sessions, `400` for malformed route IDs, `404` for resources outside the caller's visible scope, `403` for a forbidden action on a visible resource or an invalid write origin, `409` for revision or state conflicts, and `422` for field validation.

The auth module owns session resolution and the origin check. The games module owns the game-access query, shared role policy and game lock. The characters module owns sheet control checks and the players module owns membership state and the active slot. Invitation services own token validation and admission. Feature controllers attach these checks to their routes. The integration owner reviews the assembled route map and legacy cutover against the table above. [Implementation ownership](plan.md)

Services take the authenticated actor and scoped resource IDs. They share the guard policy and use current database state. Scope protected reads by actor and game in the same query or read snapshot used to retrieve the resource. For existing-game writes, lock the game row first, then reload the membership, target and controller or invitation state using the same transaction. Apply the policy before modifying data or returning an idempotent replay. Keep role and control snapshots from the HTTP guard out of write authorization. Future non-HTTP callers use the same service entry points with a server-resolved actor.

### Character data and transactions

- Replace the required player parent with a required game reference and nullable controller membership. Null means GM control. Use a composite foreign key from the sheet's game and controller membership IDs to the membership in that game. Use a composite active pointer foreign key from the membership's game ID, membership ID and active character ID to the sheet's game ID, controller membership ID and sheet ID. The database then rejects cross-game assignments and active selections for sheets controlled by someone else. The transaction checks that assignment targets are current members.
- Derive player-controlled sheets' active status from the membership's single nullable active character pointer. **None** clears it. Store an explicit active flag for each GM-controlled sheet so several can appear in the workspace at once. New GM-controlled sheets start inactive. Creating a player sheet selects it only if that player's active slot is empty. Claim uses the explicit **Make this character active** choice. When unchecked, keep the player's previous selection, including an empty slot.
- Move sheet reads and writes to a stable game and character boundary such as `/api/games/:gameId/characters/:characterId`. When control changes, clear the former controller's active pointer or GM active flag for that sheet in the same transaction. The sheet is inactive under its new controller. A claim with **Make this character active** checked can select it in the same transaction. Removing a membership clears its active slot and returns its sheets to GM control as inactive. Restoration restores membership access only.
- Permanent removal applies to active and inactive sheets. From Characters management, show a confirmation that names the character and states that removal is permanent. The server checks current control after locking the game. It clears any active pointer to the sheet and deletes the sheet, its dependent data and its character invitations in the same transaction. Notify open game views after commit so they update the tab strip and roster together. Subsequent reads and saves for the deleted sheet return `404`.
- Preserve retry behavior for create. A stable request ID for the same actor and intent cannot create a second sheet after a lost response or recreate a removed sheet. Keep the request outcome separately from the sheet data and recheck access before returning a replay.
- Keep `expectedRevision` on sheet saves and player active selection. Advance the membership revision when its active pointer changes, including a forced clear. Serialize game mutations on the game row. Acquire that lock before checking current membership, control and invitation state. Keep external calls outside the transaction so sheet edits, membership removal, assignment, active changes and redemption have a consistent order.

### Invitation lifecycle

Store a stable invitation ID separately from its opaque URL token. Give each game one persistent reusable game invitation and allow multiple single-use character invitations for each GM-controlled sheet. Store a unique token digest for lookup and a recoverable encrypted token so the GM can copy the URL after reload. Use a deployment secret for encryption, keep tokens out of logs and analytics, and suppress referrer disclosure from the invitation page. Use the configured public origin for share URLs.

Disable or re-enable one link without replacing its token. Rotate only that link's token, preserving its enabled state and invalidating the old URL. Whenever a sheet changes controller, remove all character invitations for that sheet in the same transaction, including the link used for a successful claim. This applies to assignment, reassignment, takeback and membership removal that returns sheets to GM control. Old URLs stay invalid. A subsequent claim requires a new link. An active status change leaves the links in place.

Preview is read-only. After sign-in, resume only a validated in-app invite route. A valid regular link opens the game for an existing member. For other accounts, acceptance inserts player membership if eligible. Character acceptance revalidates the token and character state after acquiring the game lock. In that transaction it joins the account if needed, assigns control, applies the active choice and removes the character's links. Two competing claims have one winner. A failed claim creates no membership. An unavailable link gives current members a safe return path where membership can be verified.

### Live roster and sheet updates

Open one same-origin SSE subscription per open game view, shared by the main screen and Characters management. Authenticate the session and check game access when subscribing. After a roster mutation commits, notify that game's subscribers to refetch the roster summary and any affected access data. Send invalidation hints without sheet contents. The roster query remains authoritative. Refetch on initial connection and reconnect so clients recover from missed events without event replay.

After a sheet save commits, send a hint with the sheet ID so clients viewing it refetch the saved revision. Refresh the roster summary when a displayed field, such as the character name, changes. On initial connection and reconnect, refetch the open sheet as well as the roster. When a local draft exists, retain its original base revision and keep the latest saved version separate. Use the existing revision check on save and let the editor review any conflict before retrying.

Use the game member guard before opening the stream and keep authorization checks on every HTTP read and write. Track subscriptions by game, account and session. Register a pending subscription so revocation can cancel it during setup. Start streaming only if the subscription is still pending after a fresh session and game-access check. Close affected streams on membership removal, sign-out or session expiry. Keep the Arrow Express route handler pending until stream cleanup and response end so the adapter does not try to send a second response. Revalidate the roster when the stream fails so an expired session or lost membership sends the user to an allowed screen. Send heartbeats, verify that the deployment proxy streams responses without buffering, and release subscriptions when the view closes. A single backend process can deliver events in memory. Multiple backend instances require shared delivery.

### Frontend integration

Promote the reviewed presentation from the [prototype folder](../../../packages/frontend/prototypes/gm-player-separation/) into production modules. Use controllers and Vue Query for API state; preserve the dark palette, semantic tokens, tab layout, keyboard behavior, headings, modal flows and status labels described in [UI](ui.md).

| Prototype component | Production connection |
| --- | --- |
| `GamePicker`, `CreateGameScreen` | Use the account-scoped games query, existing system catalog and create-game validation. Show the returned role and open the created game. |
| `GameRoster`, `CharacterPreview` | Drive tabs from game-level summaries and fetch the selected full sheet by game and character ID. Keep the read-only badge and shared `CharacterSheet`. Use [CharacterView's](../../../packages/frontend/src/modules/characters/CharacterView.vue) sheet adapter and server-derived values; leave the prototype calculation helpers in the gallery. |
| `CharacterSettings`, `CharacterControlTile` | Render summaries, controller choices and allowed actions from live data. Every member can open inactive sheets using the same sheet controller as the workspace. Show **Read-only** for players who do not control the sheet. On assignment or active status changes, refresh the roster, membership and affected sheet permissions. |
| `MembershipPanel`, `InvitationManager` | Back GM settings with scoped queries and mutations. Preserve independent link controls and removal confirmation. Refresh affected roster and settings data on success. |
| `InvitationAcceptance` | Bind to the routed token, authenticated preview and explicit acceptance. Return the game and optional claimed character ID for navigation. Keep the default active choice and unavailable state. |

Replace `GameSeparationPrototype`'s in-memory state, simulated login and review controls with production routes and controllers. Keep the workspace tab strip limited to active characters. If create or claim returns an inactive character, open its sheet in Characters management. Opening it there leaves active status unchanged.

Use account-scoped query keys and discard protected cache entries and stale responses on logout or account change. Revalidate permissions when reopening or refocusing the workspace and after access-related failures. If a sheet remains readable after edit access is lost, switch it to read-only and keep unsaved input separate from the server snapshot. If read access is lost, hide the sheet and return to a permitted view. Extend [optimistic saves](../../../packages/frontend/src/shared/useOptimisticSave.ts) to stop dispatch on access loss and retain a local draft when appropriate; the current conflict and unknown-outcome path discards queued edits. Do not replay a rejected draft automatically.

### Compatibility

- The UX explicitly excludes migration of existing games, player records and sheets. Use an empty or deliberately reset database for the new release and keep applied migration history immutable. Define the fresh schema and update the Drizzle journal for fresh installs and test schemas. If deployed data must survive, agree on how to establish GM ownership before rollout; legacy rows have no account identity to infer it from.
- Replace the legacy anonymous player-creation and player-nested sheet APIs in the same release as their frontend callers. Legacy URLs must not bypass authorization. No bookmark compatibility is assumed.

### Verification targets

Cover local registration, duplicate usernames, failed sign-in throttling, and expired or signed-out sessions at the API boundary. Extend the [game API tests](../../../packages/backend/src/modules/games/games.test.ts) and [character API and persistence tests](../../../packages/backend/src/modules/characters/) to verify different roles for the same account across games, cross-game ID tampering, full read access regardless of active status, and writes scoped by control. Test inactive GM creation, multiple active GM sheets, player selection and clearing, rejection of GM overrides, and activation clearing when control changes. Use PostgreSQL integration tests with competing transactions for claims, rotation versus acceptance, and removal or reassignment versus save and active selection. Verify that all prior character links stay invalid after a controller change and that permanent removal clears the sheet, its dependent data, active pointer and links.

Verify the assembled app mounts each route group under its expected `/api` path and that guard denials short-circuit the route handler. Exercise invalid session, cross-origin write, hidden resource, visible resource with insufficient authority, forged actor or role fields, and an eligible nonmember accepting an invite. Test service calls directly as well, including a write that passed its HTTP guard before membership or control changed. Assert that database constraints reject cross-game controllers and active pointers to another controller's sheet.

Extend [sheet browser tests](../../../packages/frontend/src/modules/characters/CharacterView.browser.ts) for read-only rendering, opening an inactive sheet in Characters management without changing the active selection, access changes during save, and account changes with cached data. Update the [end-to-end journeys](../../../packages/tests/src/features/) to use signed-in accounts: a GM creates and runs a game without players, and another account signs in from an invite, joins or claims, and sees the correct sheet permissions.

Verify that another open game view updates after activation or removal, an open sheet reflects a remote save without overwriting a local draft, reconnect loads missed changes, and revoked users lose the stream and cannot read or write game data. Cover confirmation and removal of an active sheet by its assigned player, including clearing the active slot, and rejection when that player targets another controller's sheet.
