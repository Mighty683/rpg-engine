# Private rolls — UI specification

**Created:** 2026-11-12

## Scope

Add a privacy choice to the existing roll flow. The user requested a checkbox and no prototype; this document is the implementation handoff, not an approved visual prototype. The [UX journey](ux.md) records the audience rules and untested assumptions.

## Roll setup

In both the character/NPC roll dialog and the free roll dialog, place a Nuxt UI `UCheckbox` labeled **Private roll** after the note and before the action buttons, using existing form spacing and semantic tokens. Show it to both GM and player wherever they may make a roll. It applies to all dice and outcomes in the submission, including opposed rolls. Its helper text reads: **Only you can see this roll, including the result and note.** When unchecked, the roll is visible to all game members. The checkbox starts unchecked on a new roll, including an NPC roll; this is a proposed default preserving current behavior.

The checkbox represents the signed-in author, independent of **Roll as**, character ownership and NPC visibility. A player’s private roll is hidden from the GM. A GM’s private roll is hidden from players. Do not offer an audience picker or imply that the GM can read all private rolls.

Keep the choice when a known submission failure leaves the dialog open; disable it with the other fields while submitting. Report API errors in an actionable toast. If the outcome is uncertain, tell the user to check history before retrying. Local validation can remain in the form; API error text must not appear inline.

For a reroll, initialize the checkbox from the source entry. The user can change it for the new roll; show the current checkbox state beside the copied setup and note before submission. The original entry is unchanged. Canceling discards the draft.

## Throw history

Show a compact **Private** text label on the author's private result card, adjacent to its title, using the existing dark palette and semantic tokens. Keep the normal result, reroll and remove controls. Public cards retain their existing appearance. Private entries from other accounts are absent, including for the GM; do not show placeholders, counts or notifications that reveal their existence. Existing records display as public.

Keep the existing chronological list, older-page control and live refresh. An empty state describes the visible history without suggesting another member has private rolls. Do not add a filter or an action to change an existing entry's visibility in this iteration.

## Keyboard and focus

Use the checkbox's native label association and keyboard behavior, with the existing Nuxt UI focus-visible style. Place it in the normal tab order before **Cancel** and **Roll**. Preserve the existing dialog focus management and return focus to the invoking control on close. The **Private** label is text, not color or an icon alone.

## Implementation and verification targets

- Update `RollDialog.vue` and `FreeRollDialog.vue` consistently; connect draft, submission and reroll state in `GameTable.vue` and shared types. Reuse existing components and tokens; avoid a separate prototype.
- Verify both roles across character and free rolls, and GM NPC rolls, including opposed rolls. Check default, toggling, cancel, pending, known failure, uncertain submission and reroll with either visibility.
- Verify the author sees a labeled private entry, all members see a public entry, and neither a GM nor another player receives or can access someone else's private entry. Cover initial and older history, live updates, reconnects, cached data, reroll and removal. Authorization must be enforced by the server, not by the display alone.
- Verify keyboard operation, focus return, and error toasts in both dialogs. Inspect at the supported table layouts using the existing application rather than a prototype gallery.
