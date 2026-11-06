# Simulated application review: player

**Date:** 2026-11-06  
**Method:** An AI agent used the application at `http://127.0.0.1:5175` while considering the [provisional player persona](../personas/player.md). The session used the existing `demo-player` account and The Lantern Road game.  
**Status:** Simulated review, not a participant interview. Usability interpretations are hypotheses, not validated player needs.

## Observations

- The games list showed The Lantern Road, identified as a Fabula Ultima game with the Player role, and a Create game button. No join option or joining guidance was visible there. The joining journey was not tested.
- The game opened with Nera Vale selected and editable. Rowan Ash was available in another tab; its sheet was marked Read-only and its fields were disabled. Character management identified Nera as controlled by `demo-player` and Rowan as GM-controlled.
- On Rowan's read-only sheet, the About buttons were also disabled.
- Nera's current HP was changed from 35 to 34. After a reload, it remained 34 and the sheet displayed Saved. HP was restored to 35 afterward. Save failures and concurrent edits were not tested.
- The Create character dialog displayed “Enter a character name.” when submitted empty. No character was created, so creation and assignment were not tested end to end.
- The browser console showed no warnings or errors during this session. This does not establish that other flows are error-free.

## Interpretation and feedback

- Finding an existing game, editing an assigned sheet, and switching to another character were possible in this session. The saved HP change survived a reload.
- A player looking for a way to join a game may need an entry point or guidance on the games list. The review did not establish whether joining is available elsewhere.
- Ownership and the reason for read-only access were clearer in character management than on the sheet. Showing that context on the sheet or tabs could reduce uncertainty while switching characters.
- Disabling explanatory About controls on a read-only sheet may prevent a player from learning about information they can view. Consider keeping informational controls available independently of editing permissions.
- A Saved indicator provides useful reassurance, but this session did not establish how clearly pending saves, failures, or other people's changes are communicated.

## Limits and follow-up

The persona is provisional and based on assumptions rather than participant research. This was one simulated session with an already signed-in player and seeded game, not an interview or a representative usability test. It did not cover joining, successful character creation, assignment, failure recovery, concurrent changes, other devices, or a full play session. Test those journeys with real players before treating these interpretations as validated findings.
