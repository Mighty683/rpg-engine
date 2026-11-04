# Game creation — UI solution

**Created:** 2026-11-04  
**Status:** Proposed design; not implemented or tested.  
**Related:** [UX journey](ux.md) · [Recap](recap.md)

## Scope and visual approach

Replace the current [landing placeholder](../../../packages/frontend/src/App.vue) with a simple saved-games list and a creation view. The [UX journey](ux.md) defines the single-GM scope, database persistence, fixed RPG system, and deferred player and system-setup workflows. There is no separate story yet. The [GM persona](../../research/personas/game-master.md) and [interview](../../research/interviews/game-master.md) are simulated; they do not validate this design.

Retain the existing `UApp`, `UContainer`, and default theme surfaces and text tokens. Use existing Nuxt UI buttons, form controls, and feedback components with restrained spacing and borders; no new visual system is needed. Keep the content in a readable column that fits narrow screens, with controls wrapping rather than overflowing.

## Games list — first screen

- Display the heading **Games**, with a prominent **Create game** button alongside it on wide screens and below it when space is limited.
- Show each saved game's name and RPG system in a simple, non-interactive row. Do not imply a game can be opened, edited, or deleted; those actions are not required for now.
- While loading, show **Loading games…**. If the list is empty, show **No games yet. Create your first game.** Keep the create button visible.
- If loading fails, show **Could not load games.** and a **Retry** button. Do not show the empty state for a failed request. Creating remains available if its own dependencies are available.
- After confirmed creation, return to the list, show **Game created: [name].**, and refresh the list. If the refresh fails, retain the success confirmation and show the list error rather than claiming the save failed.

## Create game view

Use a dedicated view in the same container, headed **Create game**, with a short vertical form:

1. **Game name** — required text input, maximum 20 characters.
2. **RPG system** — required selection from available systems. Start with **Select a system** rather than silently selecting one. Beneath it show **The RPG system cannot be changed after the game is created.**
3. **Create game** primary button and **Cancel** secondary button.

Do not ask whether the game is a campaign or a single session, request player information, or add system-configuration controls. The system catalog may initially be hardcoded; system setup remains a separate task. While systems load, indicate **Loading RPG systems…**. If none are available, explain **No RPG systems are available.** If loading fails, explain **Could not load RPG systems.** and offer **Retry**. Keep the name editable and creation disabled until a system is available and selected; do not add a dead link to system setup.

### Submission and feedback

| State | Presentation and interaction |
| --- | --- |
| Missing or invalid input | On submission, show a specific message beside each affected field, such as **Enter a game name**, **Use 20 characters or fewer**, or **Select an RPG system**. Preserve all entries and focus the first invalid field. |
| Saving | Show **Creating game…** and disable repeat submission and form changes until the outcome is known. Do not show success before the database confirms the save. |
| Confirmed failure | Show **Could not create game. Your entries are unchanged.** Preserve entries and allow retry or cancellation. Include a useful, safe explanation when available. |
| Unknown outcome | Show **We couldn't confirm whether the game was created. Check the games list before trying again.** Offer **Check games**; do not automatically retry or assert success or failure. Keep the draft in memory while checking, and offer **Return to setup**. A retry may create a duplicate. |
| Confirmed success | Clear the draft only after confirmation, return to the list, and identify the created game as above. |

## Navigation, focus, and draft behavior

- On entering the create view, focus the game-name input. Use normal Tab order through the name, system selection, primary action, and Cancel; submitting with Enter follows the form's validation and pending-state rules.
- Cancel with no entered information returns to the list. If there are entries, ask **Discard this game setup?** with **Keep editing** and **Discard**; keeping returns focus to the initiating control, while discarding returns to the list without creating a game. Apply the same protection to in-app navigation away from a modified draft, except the explicit unknown-outcome check, which preserves it in memory.
- On validation failure, focus the first invalid input; associate each message with its field. On returning to the list, focus its heading or the create button; on returning from an outcome check, restore focus to the relevant form or status message.
- Preserve input during validation, system-loading errors, confirmed save failure, and an in-app outcome check. Unfinished setup is lost on reload or application restart; do not promise recovery. Browser-controlled leave warnings may be used where supported, but cannot guarantee preservation on restart.
- Announce loading, errors, and creation confirmation without moving focus unexpectedly. Do not treat the pending state as a successful save.

## Verification targets

- The first screen distinguishes loading, empty, populated, and failed lists; saved games remain listed after restart.
- The GM can create a named game with an available system, is warned that the system is fixed, and sees confirmation only after saving.
- Required-field errors retain entered values; cancellation and navigation protect an in-progress draft, while reload loses it as specified.
- System unavailability, list failure, save failure, and unknown outcomes are truthful and recoverable without automatic duplicate submission.
- The layout remains usable at narrow widths and supports keyboard navigation. No player, game-opening, or system-configuration flow is implied.
