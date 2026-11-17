# GM table Agent — acceptance handover

**Status** · Implemented and verified on 2026-11-17. [Story](story.md) · [UX and prototype](ux.md) · [Technical design](tech.md) · [HTTP contract](openapi.yaml)

## Acceptance criteria

The game’s GM can consult current game facts, prepare rolls and review character or NPC edits from the production game table. Completed conversations survive a backend restart. Authorization, turn limits and read visibility apply at the server. A prepared action changes game state only after the GM submits it through the existing game workflow.

Implement the browser journeys in `packages/tests/src/features` using Cucumber steps and page objects. Implement the HTTP cases in `packages/tests/src/api` using Vitest and disposable PostgreSQL. Use the real application with an injected, scripted provider. Assert outgoing context, tool arguments, visible outcomes and persisted effects. A scripted provider exercises the integration. Record the pinned model’s actual interpretation of the four launch prompts separately during the deployment check specified in the technical design.

## Browser E2E — production table and history

```gherkin
Scenario Outline: GM-E2E-01 — Use the compact chat alongside the table
  Given the GM opens the game table at a viewport width of <width> pixels
  When the GM opens Agent, asks who is in the party with Enter and types a second draft
  And the GM closes Agent, opens Throw history, presses Escape and reopens Agent
  Then the active party reply and second draft are visible
  And the table remains usable and the Agent window fits the viewport
  Examples:
    | width |
    | 793   |
    | 360   |

Scenario: GM-E2E-02 — Recover an unavailable draft
  Given the GM opens a table with Agent unavailable
  When the GM types a message and minimizes and reopens the chat
  Then the draft remains editable and Send is disabled
  When Agent becomes available and the GM sends the draft
  Then the completed conversation displays the message once and clears the submitted draft

Scenario: GM-E2E-03 — Read older messages without losing the reading position
  Given the GM has 45 completed turns and opens the game after a backend restart
  Then the latest 20 turns appear in chronological order with the newest reply at the bottom
  When the GM scrolls to the top
  Then the preceding 20 turns appear above the same visible message at the same pixel offset
  When a second GM session completes a turn while the GM reads older history
  Then the reading position stays fixed
  When the GM scrolls to the top again and then returns to the bottom
  Then the first five turns and the new reply are present with no gaps or duplicates
```

Compare the **whole production table** with the Histoire Agent story at both widths for minimized, open, unavailable and Throw history states. Check the fixed bottom-left launcher, close control, keyboard behavior and nonmodal panel. Reference window sizes are 360 × 420 and 336 × 420 respectively at the reviewed viewport heights. Capture paired screenshots and record discrepancies for the delivered revision.

## Browser E2E — rolls, advice and edits

```gherkin
Scenario: GM-E2E-04 — Resolve an ambiguous hammer before a weapon roll
  Given Robert carries a War Hammer and a Light Hammer with different accuracy setups and Agile is a hidden NPC
  When the GM sends "Robert attacks Agile with hammer"
  Then the Agent asks which hammer to use and throw history is unchanged
  When the GM answers "War Hammer"
  Then the preview identifies Robert, Agile and the War Hammer with its saved accuracy dice and bonus
  When the GM confirms a public roll
  Then one accuracy result appears and its public record omits Agile's identity
  And Agile's HP is unchanged

Scenario: GM-E2E-05 — Prepare a check using the current character sheet
  Given Christine's current DEX die is d8
  When the GM sends "Christine make check roll for agility when tumbling"
  Then the preview shows Christine rolling DEX + DEX with two d8s and the note "Tumbling"
  When the GM confirms the check
  Then the roll shows two faces and the total without claiming success against an unspecified difficulty

Scenario: GM-E2E-06 — Roll free dice and reroll a specific private result
  Given the GM has the Agent open
  When the GM sends "Make 2x10d roll", selects Private and confirms
  Then one GM-authored private free roll shows two d10 faces and their sum
  When the GM sends "Reroll my last private throw" and confirms a private reroll
  Then history contains a second result and the original result is preserved

Scenario: GM-E2E-07 — Advise from learned skills
  Given Robert has a learned accuracy skill with a recorded trigger and cost
  And a different learned skill adds damage only after a hit
  When the GM asks "What skill can use Robert to make better shot?"
  Then the reply identifies the accuracy skill and explains its trigger and cost
  And the GM sees a character lookup with no roll or edit to confirm

Scenario: GM-E2E-08 — Review a character change against a concurrent edit
  Given Robert has 10 HP and the GM asks "Set Robert's HP to 8"
  When another GM session changes Robert's HP to 9 before the GM accepts
  Then acceptance reports the revision conflict and Robert retains 9 HP
  When the GM reviews the refreshed change from 9 to 8 and accepts
  Then Robert's sheet shows 8 HP after reload

Scenario: GM-E2E-09 — Cancel and then approve a hidden NPC edit
  Given Agile is a hidden NPC with a saved attack
  When the GM asks "Set Agile's notes to guarding the bridge" and dismisses the preview
  Then Agile's saved notes retain their previous value
  When the GM requests the change again, reviews it and accepts
  Then Agile's sheet has the new notes, the same attack and hidden visibility after reload

Scenario: GM-E2E-10 — Keep the Agent off the player table
  Given the GM has a persisted conversation about Agile
  When a player opens the same game's table
  Then the ordinary table is usable and neither the Agent launcher nor its transcript is visible
```

## API integration — permissions, tools and game state

| ID | Input and expected outcome | Persisted effect |
| --- | --- | --- |
| GM-API-01 | Call status and turns as signed-out, player and nonmember callers using otherwise valid requests. Expect 401, 403 and 404 respectively. Invalid Origin or CSRF on an authenticated GM POST returns 403. No rejected request reaches the provider. | No transcript or game writes. |
| GM-API-02 | Seed distinct markers in a hidden NPC’s notes, a public throw, the GM’s private throw and another account’s private throw. Inspect provider requests for party, NPC and prior-roll questions. Initial context contains identities. Relevant detail reads can include the first three markers. The other author’s private marker never appears in requests, replies, history or game events. | Successful reads append completed turns only. |
| GM-API-03 | Request a cross-game target, an unlearned skill and an unsupported class-library operation. Also exercise a sheet with only a damage benefit or an already-applied passive. Check tool results contain only authorized learned facts and identify applied benefits. Unknown tool names and malformed arguments cannot dispatch an operation. | No roll, skill assignment, sheet or catalog change. |
| GM-API-04 | Prepare the three launch rolls with uniquely resolved actors. Inspect roll kind, attribution, revisions, weapon ID, dice, modifiers, note and visibility. Repeat with an incomplete weapon, an explicit second attribute and an unsupported free pool (3d10). Incomplete or unsupported setups yield no executable proposal. The explicit attribute replaces the suggested second DEX. | Preparation and clarification leave throws and HP untouched. A confirmed roll through the ordinary API creates one result. |
| GM-API-05 | Request two changes in one message, then request a stale character or NPC edit. A turn returns at most one executable proposal. A stale submission through the normal write API returns 409. Replay a history GET after a completed preparation. | A preview leaves revisions unchanged, stale writes preserve intervening edits, and reloaded history contains no executable action. |
| GM-API-06 | Revoke a session while a tool is pending, or remove a previously included party member during the turn. Expect loss of authorization or 409 agent_context_changed as applicable. Verify the adapter receives no further restricted context. | No completed turn or mutation. The next authorized request can acquire the slot. |

## API integration — admission, recovery and persistence

| ID | Input and expected outcome | Persisted effect |
| --- | --- | --- |
| GM-API-07 | Hold one GM POST open. Race a second session in the same game (409 agent_game_busy) and another GM in a different game (admitted). Fill ten independent game slots, then try an eleventh (429 with Retry-After). Use distinct accounts to isolate concurrency from account limits. | Only completed admitted turns are stored, each under its own game and GM. |
| GM-API-08 | Six admitted turns in one minute across a GM’s games and sessions succeed. The seventh receives 429 with Retry-After. After the window expires, another turn succeeds. | The rejected request creates no turn and consumes no provider call. |
| GM-API-09 | Drive the scripted adapter to the 10-second deadline, tool exhaustion, token exhaustion and bad upstream responses. Assert at most 20 model calls, 10 tool calls, 20,000 cumulative input tokens and 2,000 cumulative output tokens. Repeated context counts each time. Assert 504 on timeout, 502 on invalid responses/tool exhaustion and 503 on temporary unavailability. Also exercise disconnect, late completion and recovery. | Failed turns leave no partial transcript or game write. A subsequent valid turn succeeds and commits once. |
| GM-API-10 | Page an empty transcript, then one containing over 50 turns with an append between page requests. Check default 20, maximum 50, exclusive before cursor, ascending order within pages, stable IDs and final null cursor. Unknown and other-game anchors return 404. | Reads leave rows intact. Each pre-existing turn is reachable exactly once while paging backward. |
| GM-API-11 | Complete a turn, lose the response after commit, and reconnect against a restarted backend using the same database. Refresh history before offering retry. | Exactly one intact turn with the submitted text, ordered summaries and reply. Raw provider payloads and executable proposals are absent. |

## Verification evidence

Verification uses disposable PostgreSQL, a scripted provider for CI and the actual GM table in Chromium. The archived UI adds inline roll and edit cards, bottom-left positioning and optimistic message submission. Migration 013 was applied and checked in the local development database. Concurrent confirmation tests verify that a single Agent turn creates one throw, and browser reload tests verify the linked outcomes remain in chat. Synthetic Mistral verification of the HP adjustment checked both a complete request and a numeric reply to a clarification.

| Coverage | Evidence |
| --- | --- |
| GM-API-01 and 10 | [GM permissions and transcript pagination](../../../../packages/tests/src/api/agent-history.integration.test.ts) |
| GM-API-02, 03, 06–09 and 11 | [Visibility, learned skills, budgets, admission and restart recovery](../../../../packages/tests/src/api/agent-runtime.integration.test.ts) |
| GM-API-04 and 05 | [Roll preparation](../../../../packages/tests/src/api/agent-rolls.integration.test.ts) and [revision-checked edit previews](../../../../packages/tests/src/api/agent-edits.integration.test.ts) |
| GM-E2E-01–03, 07 and 10 | [Table chat, pagination, multiple sessions, skill advice and player exclusion](../../../../packages/tests/src/features/agent-chat.feature) |
| GM-E2E-04–06, 08 and 09 | [Roll review and private reroll](../../../../packages/tests/src/features/agent-rolls.feature) and [character conflict, NPC cancel and save](../../../../packages/tests/src/features/agent-edits.feature) |

The original integrated `pnpm verify` run passed formatting, lint, type checks, OpenAPI validation and bundling, both builds, 247 unit tests, 31 frontend browser tests, 12 backend migration and integration tests, 69 API tests and 35 end-to-end cases. This covers all 21 handover IDs, including both widths for GM-E2E-01. The cross-session history assertion allows time for the documented two-second refresh. The NPC keyboard workflow waits for the preceding save to finish before focusing its editor.

Both development entry points started on isolated loopback ports. The backend served the Agent OpenAPI paths, the frontend served the application, and the frontend proxy returned a session CSRF token.

### Live Mistral verification

The production adapter called `mistral-small-2603` with all six tools registered, using an isolated synthetic game. Each row below completed with HTTP 200. Timings are individual end-to-end samples. The synthetic runner asserted the returned setup against the seeded records.

| GM request | Observed result | Time |
| --- | --- | ---: |
| Robert attacks Agile with hammer | Read Robert, then prepared his War Hammer against Agile, DEX d8 and MIG d6. The public note was empty. | 2.23 s |
| Christine make check roll for agility when tumbling | Read Christine, then prepared DEX d8 twice with the note “Tumbling”. | 1.72 s |
| Make 2x10d roll | Prepared a GM free roll with two d10s. | 1.30 s |
| What skill can use Robert to make better shot? | Read Robert’s learned skills. Returned Steady Aim, before a ranged shot, 2 MP for +1 accuracy. | 1.25 s |
| Set Robert’s HP to 8 | Prepared a character edit containing only his HP change. | 1.81 s |
| Set Agile’s notes to guarding the bridge | Prepared an NPC edit containing only the notes change. | 1.47 s |
| Robert attacks Agile with hammer, with two matching hammers | Asked which of War Hammer and Light Hammer to use. The follow-up “War Hammer” prepared Robert’s selected weapon against Agile. | 2.08 s + 2.75 s |

Early live runs exposed confusion between skill advice and attribute checks, ambiguous hammer selection and premature claims of a save. The runtime now distinguishes an activity from a learned skill, carries the original attack into a weapon-selection follow-up, and supplies the recorded review acknowledgment and weapon clarification from validated tool results. Model interpretation can still vary. The automated suites use a scripted provider for repeatable game-state and privacy assertions.

### Production screen comparison

Before the move to bottom-left, the Histoire story and production GM route were captured in Chromium at 800 px viewport height. Both panels measured 360 × 420 at width 793 and 336 × 420 at width 360, with 12 px right and bottom margins. Production includes the signed-in header, management controls and seeded NPCs. Throw history shows the actual fixture contents. Each pair places the reference at left and the production route at right.

| Viewport | Minimized | Open | Unavailable | Throw history |
| --- | --- | --- | --- | --- |
| 793 px | [Compare](evidence/793-minimized.webp) | [Compare](evidence/793-open.webp) | [Compare](evidence/793-unavailable.webp) | [Compare](evidence/793-history.webp) |
| 360 px | [Compare](evidence/360-minimized.webp) | [Compare](evidence/360-open.webp) | [Compare](evidence/360-unavailable.webp) | [Compare](evidence/360-history.webp) |

Database verification passed on a disposable schema in the configured test database. Applied the committed 001–011 journal as schema owner, seeded the demo and inserted one throw. Verified agent_turns was absent, ran migration 012 twice and compared all rows in games, characters, npcs, npc_attacks and throws. The one game, two characters, three NPCs, three attacks and one throw were preserved, and the initial transcript was empty. Applied runtime-grants.sql as owner and switched to a new restricted role. The role inserted a turn using the identity sequence, paged it by game and GM, updated an NPC and replaced its attack. UPDATE and DELETE privileges on agent_turns were false. Removed the disposable schema and role after verification. [Database preparation](tech.md#database-and-api-contract)

### Release decisions

The implemented review shows field-level changes, uses the ordinary save paths and requires fresh confirmation after a revision conflict. The editable fields are listed in [the technical design](tech.md#rolls-and-profile-edits). Deployment-wide enablement and the real-game provider data policy remain with the project owner. The default configuration keeps Agent inference disabled.
