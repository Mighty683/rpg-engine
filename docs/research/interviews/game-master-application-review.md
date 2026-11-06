# Simulated application review: game master

**Date:** 2026-11-06  
**Method:** An AI agent explored the application at `http://localhost:5175` while considering the [provisional game master persona](../personas/game-master.md). The session used the signed-in `demo-gm` account and The Lantern Road game.  
**Status:** Simulated review, not a participant interview. Usability interpretations are hypotheses, not validated game master needs.

## Observations

- The games list showed The Lantern Road as a Fabula Ultima game with the GM role. The workspace displayed tabs for Rowan Ash and Nera Vale, with one editable character sheet at a time.
- The GM switched to Nera's sheet. After opening Settings and choosing Return to game, Nera remained selected. The sheet displayed Saved; no sheet values were changed during this review.
- Characters management grouped Rowan under GM characters and Nera under `demo-player`. It showed their active status and controller, and provided controls to assign control, open sheets, make characters inactive, and remove them. The GM opened Nera's editable sheet from management.
- Settings showed the active player and invitation controls. Invitations and access changes were not exercised.
- Submitting the Create character dialog with an empty name displayed “Enter a character name.” No character was created.
- The sheet identified manual advancement and calculations that do not include skill and other effects. It offered a Lock editing control, but its effect on other users was not tested.
- The browser console showed no warnings or errors during the reviewed flows. No application error was confirmed; this does not establish that untested flows are error-free.

## Interpretation and feedback

- Character tabs provide quick access to individual sheets. A compact party overview of current resources and relevant status could help a GM assess the situation without switching between sheets. No such overview was visible in the tested workspace.
- Ownership and active status were clearer in management than on the sheet. Showing the controller on the sheet could help the GM identify whose character is being edited.
- The sheet did not explain who can see a GM's edits or whether Lock editing affects the player. Clarifying the scope of these actions could reduce uncertainty; actual permissions and synchronization were not verified.
- No undo or change history was visible in the tested views. A way to reverse recent changes could help recover from mistakes during play; recovery elsewhere was not investigated.
- The Saved indicator and explicit notes about manual calculations are useful signals, but this review did not test save behavior, failure feedback, or concurrent changes.

## Limits and follow-up

The persona is provisional and based on assumptions rather than participant research. This was one simulated review of a seeded game, not an interview, a full session, or a representative usability test. It did not test saving changes, multiplayer synchronization, invitations, removal, recovery, other devices, or successful character creation. Validate these hypotheses and workflows with real game masters before treating them as established needs.
