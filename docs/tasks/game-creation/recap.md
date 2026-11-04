# Game creation — recap

**Created:** 2026-11-04  
**Status:** Not implemented; requirements and design remain open.

## Intent and scope

The person running the application acts as the single game master and wants to create a game. A game can be a campaign or a single session without choosing at creation. A name of at most 20 characters and an RPG system are required; the system cannot be changed afterwards. Created games are saved in the database and survive restarts; unfinished setup is lost on restart or reload. A simple game list is the first screen; no further game actions are required for now. The initial RPG-system catalog may be hardcoded; system setup is a separate task. Player workflows are outside the current scope; future identity and permissions remain unsettled.

## Delivered and verified

- The [UX journey](ux.md), [UI solution](ui.md), [technical design](tech.md), and [implementation plan](plan.md) are proposed, not implemented. The [frontend](../../../packages/frontend/src/App.vue) is a placeholder with no creation flow.
- The [README](../../../README.md) states that session management and persistence, the backend server, schema, and migrations are not implemented. No game-creation tests or verification results were found.
- No architecture decisions have been delivered for game creation. The [character setup technical design](../character-setup/tech.md) is a proposal, not an implemented game or campaign contract.
- The user requested an MVP-first approach. The proposed design defers durable retry deduplication and system-catalog lifecycle infrastructure; these are not delivered guarantees.

## Remaining work and decisions

- Agree on the creation and listing flow, validation, error handling, and observable acceptance outcomes before implementation. Opening a game is not required for now.
- Determine how a game relates to RPG systems and future characters. The [UX guidelines](../../spec/ux.md) describe a multi-system product and future GM/player scope, but do not define these contracts.
- Design and implement the necessary foundations, then verify the agreed GM journey and failure cases. Player support remains deferred.
