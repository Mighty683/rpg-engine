# Game creation — UX journey

**Created:** 2026-11-04  
**Status:** Proposed flow; not implemented or validated.  
**Related:** [Recap](recap.md)

## Scope and evidence

The request is to run the application as a single GM and create a game; player participation and player workflows are out of scope. A game can be a campaign or a single session, without choosing between them at creation. Creation requires a name of at most 20 characters and an RPG system; the system cannot be changed later. Created games are saved in the database and survive restarts; unfinished setup is lost on restart or page reload. A simple game list is the application's first screen. The initial system catalog may be hardcoded; system setup belongs to a different task. No separate story exists yet. The [UX guidelines](../../spec/ux.md) describe a minimal, multi-system RPG engine and future GM/player roles.

The [frontend](../../../packages/frontend/src/App.vue) is a landing placeholder, not a game-creation flow. The [README](../../../README.md) confirms that session management, persistence, and a backend server are not implemented. This journey is a proposal, not a description of existing functionality.

The [GM persona](../../research/personas/game-master.md) and [interview](../../research/interviews/game-master.md) are simulated, not participant research. They suggest hypotheses worth testing: a GM may want a low-effort trial, clear feedback, and a way to recover without committing a group. They do not establish required fields or validate this flow.

## Proposed journey

| Stage | GM action and experience | Outcome |
| --- | --- | --- |
| Start | Open the application as the GM to a simple list of saved games, with a clear entry point to create one and an empty state when there are none. | The GM can start without inviting players or setting up characters. |
| Set up | Enter a game name and select an available RPG system. Explain before submission that the system cannot be changed after creation. | The GM can review or change both inputs before creating the game, without choosing campaign or single-session scope. |
| Create | Submit the setup. Show progress and prevent accidental duplicate submissions while the result is pending. | Confirm success only after the game is saved in the database, then identify the created game. |
| Finish | Show a confirmation identifying the created game and return to the list or offer a way back. | The saved game appears in the list; no further game actions are required for now. |

The list and setup presentation are functional concepts, not approved screen layouts. Initial system names remain to be determined. Created games persist across restarts; unfinished setup is lost on restart or reload.

## Recovery and uncertainty

- **Incomplete or invalid input:** Explain what needs attention near the relevant input; retain the rest of the entries. Do not create a game until required information is valid.
- **Cancel or leave:** Allow the GM to abandon setup without creating a game. If entered information would be lost, warn before leaving and offer a return to setup; draft persistence is not assumed.
- **Save failure:** Explain that creation did not complete when that is known, preserve entries, and offer retry or cancellation. Never present failure as success.
- **Unknown outcome:** If a request loses its response, do not assert either success or failure. Let the GM check the game list before retrying to help avoid duplicates; safe retry behavior needs technical design.
- **List unavailable:** Explain that saved games could not be loaded and offer a retry; do not mistake a loading failure for an empty list.
- **Unavailable service or no supported systems:** Explain the blocker and preserve the setup where possible; do not display a nonfunctional success path or fabricate options.

## Affected screens and states

- **Game list (first screen):** saved games, an empty state, loading and error states, and a create entry point. Opening a game is not required for now.
- **Creation setup:** required and optional inputs once agreed, submission progress, validation, cancellation, and failure states.
- **Creation confirmation:** identify the saved game; no gameplay controls are required for now.

These may be views, panels, or other UI structures; their visual design is deferred. AI-driven creation is not specified by this task, despite the general AI-first product intention.

Validate the journey with actual GMs once the creation scope is defined; simulated research cannot establish usability or demand.
