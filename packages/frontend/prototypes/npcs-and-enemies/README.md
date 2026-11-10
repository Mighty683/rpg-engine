# NPC table review

Open **Prototypes / NPCs and enemies / Game table with NPCs** in Histoire.
The shared MSW backend serves production HTTP clients; no running application backend is needed.

1. Use a character card's edit button or the **Character sheets** panel to select a character.
2. Edit the sheet or its game tags, then click **Save character**. Unlike production autosave, this prototype uses an explicit save so reviewers can see the persisted boundary. Cards show saved data only.
3. Switching to another sheet asks for confirmation before discarding an unsaved draft. Cancel keeps the current sheet and draft. Closing and reopening the panel keeps the current draft.
4. Use **Add NPC** to create a named NPC, add tags/notes, and **Save NPC**. Existing NPC cards reopen their own sheet.
5. Attribute, weapon, NPC attack, and free-roll dialogs persist throws; history supports reroll and removal. NPC checks use the GM free-roll endpoint with the NPC/attack name in the note; they do not claim production NPC combat automation.
6. Switch **View as** to Player to review read-only sheets/NPCs. Table-content controls retain loading, error, empty, and filtered review states. Settings remains an explicitly labelled navigation preview.

Persistence lasts for the prototype backend session, not across a page reload. Failed requests show an error and retain the edit/roll draft rather than pretending to save.

Endpoint details: [API-CONTRACT.md](API-CONTRACT.md).
