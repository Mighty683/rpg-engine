# UX guidelines

Document each task’s user flow, screen design, and prototype decisions together in its `ux.md`.

- Application purpose is to give GM and players online tooling for playing Fabula Ultima RPG system. Application is used together with communicators like google meet and discord, thus it's focus is on showing state of the game and allowing simplify management of characters and NPCs
- Application can be run by GM solely, then he is responsible for all edits, or with players, then they are responsible for edits in their area: character
- We will have two main users MG and player, MG can manage everything, player only it's personal scope
- UI should be sleek and minimal, we want to keep all is needed to run a game on the screen visible at all time. We do not create standard web application, screen should resemble more of game screen
- Use optimistic updates for inline edits: reflect the change immediately and save automatically in the background. Do not introduce Save/Discard forms or block navigation for ordinary inline edits. Queue successive edits safely and keep dependent views consistent. Revert confirmed rejections; preserve uncertain changes until refresh/reconciliation, with recovery offered through an error toast. Incomplete multi-step choices remain local until valid and must not be presented as saved.
- Do not duplicate information on the same screen, each bit of information should be shown once per visible screen
- Communicate every API error through a toast that clearly explains what happened and, when possible, what the user can do next. Do not show API error messages as red text in the interface.
- Do not care about WCAG for now
- We will try to make it AI first, any operation done by users can be done by prompting it to agent which will manage the session

## Navigation

- Keep the main destinations visible in the signed-in header. Place Games and Class library beside the app name when they fit. Move the links to a second row on narrow screens. Put session actions such as Sign out in the Account menu.
- Show which section is active. Game tables and their subpages belong to Games. Keep the current game's name and return link in the page context, and keep game-specific destinations and actions there.
- Reserve the page heading's actions for work on that page, such as Create game or Create class. Preserve contextual return links when a workflow crosses sections, such as returning to a game's classes from the class library.
