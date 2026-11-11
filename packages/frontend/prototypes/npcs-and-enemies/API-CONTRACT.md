# NPC table prototype API contract

The shared MSW bootstrap owns all persisted state. This folder does not keep a second backend.

- `GET /api/prototype/npcs` → `{ npcs: Npc[], tags: Tag[] }`
- `PUT /api/prototype/npcs/:id` body `{ npc: Npc, tags: Tag[] }` → `{ npc: Npc }`
- `PUT /api/prototype/characters/:id/tags` body `{ tags: Tag[] }` → `{ tags: Tag[] }`

`Npc` and its related prototype types are defined in `types.ts`; `Tag` comes from `tags.ts`. Seed NPCs from `fixtures.ts` (`allNpcs`). These are prototype contracts, not a proposed production schema.
NPC writes are GM-only; character tags are GM-only in this prototype. Persist tags and expose them on party projections.
Character sheets use injected `characters.getGameCharacter/saveGameCharacter` and refresh `gameTable.getGameParty` after successful saves. Game ID comes from `prototypeGameId` in `prototypes/api.ts`.
Throws use the production game-table API, including free-roll submissions for NPC checks (no production NPC entities).
