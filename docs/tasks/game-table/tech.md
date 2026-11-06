# Game Table — technical design

**Created:** 2026-11-06

The Game Table becomes the Fabula Ultima game workspace. It combines the active party, the existing character sheets, and a shared throw history. The [UX journey](ux.md) and [UI prototype](ui.md) define the interaction and presentation. This design covers live data, roll resolution, and permissions. It does not add attack targeting, damage, resource changes, fixed Difficulty Levels, group or support checks, or Fabula Point spending.

## Existing boundaries

- The [game service](../../../packages/backend/src/modules/games/service.ts) resolves the signed-in GM or current game membership. Game, roster, and sheet writes already share a per-game transaction lock. The [character workspace service](../../../packages/backend/src/modules/characters/workspace-service.ts) knows which characters are active and editable; its roster response does not have enough data to render the compact cards.
- The [Fabula rules module](../../../packages/backend/src/modules/fabula/rules.ts) already owns sheet data and derived statistics. Sheets store base dice and weapon accuracy configuration. They do not store temporary die changes for a particular roll.
- The [game workspace](../../../packages/frontend/src/modules/games/GameView.vue) already owns Settings, character management, sheet navigation, and live updates. The [prototype](../../../packages/frontend/prototypes/game-table/GameTablePrototype.vue) demonstrates the new layout and dialogs with local state, fake roles, and seeded results. Production has no throw history yet.

## Party and character sheets

Add a game-scoped active-party read projection under the character workspace. Reuse the roster's active criteria: GM-controlled characters must be marked active; player-controlled characters must be the active choice of a current member. Fetch the summary data in batches and return a consistent read of each character's sheet fields and derived values. Keep the existing roster and full-sheet contracts intact for Settings, character management, and the drawer.

A card receives a stable character ID and sheet revision, display name, classes, base attribute dice, current and maximum resources, Fabula Points, Defense, Magic Defense, and weapons by equipment ID. Reuse the sheet's derivation and override precedence, including valid zero overrides and unknown values. Include weapon name, equipped state, configured accuracy attributes, saved bonus, and whether the weapon is ready to roll. A weapon needs both accuracy attributes and a saved bonus (zero is valid). Show configured weapons as in the prototype even when unequipped; no equipment change occurs. Also expose whether the viewer can roll from the card. Derive this server-side independently of sheet edit permissions.

| Action | GM | Current player |
| --- | --- | --- |
| Read party, sheets, and history | Within existing game visibility rules | Within existing game visibility rules |
| Roll from an attribute or weapon card | Any active character in the game | Own active character |
| Make a roll without using a card | As GM, or as any active character in the game | As their active character at submission |
| Remove a history entry | Any entry in the game | Entries they authored |

The server checks current game access for every request. An inactive or reassigned character cannot be rolled under a permission that no longer applies. A player without an active character can still read the table and history; direct them to select a character before rolling. Removal follows authorship even when a character changes hands, but requires current game access. Sheet editing, lock behavior, and management routes retain their existing permissions. Red dice are manually configured by the person making the roll; they never roll as another account or resolve a live opponent's sheet.

## Throw contract and rules

Use a game-scoped throw module with a paged list, create, and remove boundary, following the application's existing auth, write-origin, and error conventions. The create request contains a UUID request ID scoped to the game and author, an optional source throw ID for a reroll, and a discriminated setup. No endpoint accepts faces, calculated totals, roles, display names, or a client-supplied weapon bonus.

| Setup | Client supplies | Server resolves |
| --- | --- | --- |
| Attribute | Character ID and expected sheet revision, first attribute, optional second attribute, effective die sizes, check modifier, optional red pool and note | Current roll permission, attribute labels, repeated-attribute validation, result type |
| Weapon | Character and equipment IDs, expected sheet revision, effective die sizes in weapon order, check modifier and optional note | Current roll permission, equipment ownership, saved accuracy pair and bonus |
| Free | One or two friendly die sizes, optional red pool, modifiers and note; GM chooses GM or the ID of any active character in the game; player sends the active character ID shown in the dialog as an expectation | Current role, active character attribution and result type |

A red pool is either empty or has exactly two dice. Standard dice are d6, d8, d10, and d12; an unopposed free roll may also use d4 or d20. Opposed free rolls require two standard dice per side and use Fabula opposed ranking as a manually configured check. An opposed attribute check uses the same attribute order for both sides. A repeated attribute must use the same effective die size twice on each side, but rolls independent faces. Preserve the reviewed exception: one friendly attribute die versus two red dice is a generic opposed roll and compares totals only. Weapon accuracy has no opposing pool. Trim notes and cap them at 500 characters. Accept signed 32-bit modifiers, consistent with saved weapon bonuses, and calculate totals without 32-bit truncation.

Put dice resolution in the backend Fabula module, with a pure outcome calculation and an injectable die source for tests. Use the server's uniform random integer generator in production. Two-die checks and weapon accuracy classify double 1 as a fumble and matching faces of 6 or higher as a critical; modifiers affect totals only. Opposed Fabula checks rank critical above ordinary above fumble, then compare totals only between ordinary results. Two criticals or two fumbles tie. Generic rolls have no critical or fumble classification. See [Fabula Ultima checks](../../spec/fabula-ultima/checks.md) and [weapon attacks](../../spec/fabula-ultima/weapon-attacks.md).

## Persistence, retries, and rerolls

Add a throw history migration under [backend migrations](../../../packages/backend/drizzle). Store one immutable roll snapshot per submission with game ID, a server-assigned increasing sequence, timestamp, author account ID, role at submission, optional character and equipment IDs, display names, resolved setup, note, and outcome. Store per-die sizes, labels where applicable, and faces; retain manual and weapon modifiers separately. Persist structured outcomes, including which side won or tied, so presentation does not have to re-evaluate the rules. Index live rows by game and sequence for paging. Use snapshot IDs and labels that survive character and equipment removal or renaming. Do not expose account IDs to other viewers; return a viewer-specific removal capability.

Take the existing game transaction lock before resolving access, checking idempotency, validating current character or equipment state, and rolling. A stale or no-longer-eligible selection returns an actionable error and consumes no dice; the dialog retains its draft and refreshes context. A retry with the same request ID and canonical intent returns the existing result without rolling again, even if the sheet or active character has since changed. Reusing that ID with a different intent returns a conflict. A removal marks the row deleted and keeps the idempotency record; a retry of a removed throw reports it as removed without restoring it. Check current game access before returning any prior result. Publish live change hints only after commit.

Reroll opens the matching editor with the original effective dice, manual modifiers, red pool, and note. The old result remains in history. A valid character or weapon reroll keeps the original character and equipment IDs, verifies current permissions and revision, and uses the saved roll recipe as its starting point. For a weapon reroll, keep the original accuracy pair and saved bonus from the server's source snapshot even if that weapon's configuration has changed. If the source character or equipment is gone or no longer eligible, show why the recipe cannot be rerolled in that mode and offer a fresh free roll. For a free reroll, copy the dice setup and note and use current attribution rules: a player rolls as their current active character; a GM can reuse the original character if still active, choose any other active character, or roll as GM. The submitting account is the author. GM attribution to a player-controlled character does not grant sheet editing or transfer authorship to the player. Confirming a reroll submits a new request ID.

## Client integration and live history

Keep query and mutation handling in the game workspace controller or a dedicated Game Table controller. Reuse the prototype's card, dice, and dialog presentation with typed props and emitted intents. Use the existing CharacterView and sheet controller in the drawer. The gallery can keep its local data adapter and role preview. Production gets role and capability from the session and game reads; it starts with real history or an empty state.

Use the existing account/game query key convention. Roster and sheet hints invalidate the active-party projection; add a throw-history change hint to the [game event stream](../../../packages/backend/src/modules/events/streams.ts). Events are invalidations with no roll content. The HTTP list is authoritative. Fetch the newest page initially and older pages by an exclusive sequence cursor. Deduplicate by throw ID and display in ascending sequence order. On change, refetch the loaded sequence ranges in bounded batches and fetch the newest page, removing deleted rows and preserving the viewport when loading older pages. If the newest page no longer overlaps the loaded window, reset to the newest window so the UI cannot silently show a gap. Refetch on reconnect and window focus; the current in-process stream has no replay and does not deliver across backend instances without shared fan-out.

Keep the history's header above its scroll region. The desktop grid height comes from Active party, while the stacked layout caps the history height. On initial load scroll to the bottom without highlighting. On a newly appended throw, scroll to the new entry and highlight it for one second; respect reduced motion. On submit, disable duplicate confirmation and reuse the same request ID when retrying an uncertain response. Maintain distinct loading, empty, failed and pending states.

## Verification

The [handover](handover.md) defines the required acceptance checks and records their results.

- As part of this task, split [the existing API permission suite](../../../packages/tests/src/api/permissions.integration.test.ts) into focused suites under `packages/tests/src/api` for game access and membership, character permissions, invitations, and session and origin guards. Keep cross-resource revocation checks and persisted-state assertions for ordinary requests. Drop the lock-coordinated removal and reassignment cases during the split. Share setup through test fixtures, use an isolated schema per suite, and run all suites against PostgreSQL.
- Add the Game Table API suite for permissions, validation, pagination, sequential retries, and historical attribution. Use completed changes to exercise stale selections and revoked access.
- Verify the browser journeys in the handover with live data.
