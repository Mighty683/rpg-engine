# App navigation handover

Status **Implemented**

[UX design](ux.md) · [Project UX guidelines](../../../spec/ux.md)

## Acceptance

- The signed-in shell gives Games and Class library direct links on every application screen, with Account beside the brand on phones.
- Games stays visually active on game routes. The library is active when opened from the header or from a game. Invitation routes have no active section.
- Game settings, character management, and game classes show the current game name as the return control. The standalone character sheet links back to its game.
- The library's contextual return opens the originating game's classes. Account still exposes Sign out.

## Browser journeys

- **Class management E2E-01.** From Games, open Class library, make a template, copy it into a game, and use the contextual links between catalogs. The library and game copies remain independent.
- **Game creation.** Create a game, return using the header's Games link, and reload. The game is still listed.

## Verification evidence

- In the running app, compared the header with the proposal at 728 px and 320 px. The wider layout fits on one row, the phone layout puts both links on a second row, and both fit without horizontal overflow. The implementation uses the existing 640 px breakpoint.
- Opened Class library with the keyboard, checked current-section styling and page semantics, and confirmed that the Account menu opens and closes with Escape.
- Checked the same header on the game table, settings, character management, and a managed sheet. Followed Game classes to Class library and back to the game classes and table. Browser Back from an embedded sheet returns to its game URL and the default table view, since the managed sheet is local page state.
- The standalone character regression checks the game link, Games section state, library navigation, and Sign out. The two targeted frontend browser suites passed 13 tests. The class management and game creation end-to-end suites passed 8 tests.
- Targeted formatting, lint and type checks and the frontend production build passed. The build reported a bundle-size warning.
