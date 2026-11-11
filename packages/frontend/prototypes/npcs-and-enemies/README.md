# NPC table review

Open **Prototypes / NPCs and enemies / Game table with NPCs** in Histoire.
The shared MSW backend serves production HTTP clients; no running application backend is needed.

1. Use a character card's edit button or the **Character sheets** panel to select a character.
2. Edit the sheet using the production character controller and autosave. Successful saves refresh the table cards. Game tags save independently through the prototype NPC API.
3. Switch characters using the same tabs as production. Save status and failures follow production behavior; there is no separate Save character button or prototype discard confirmation.
4. Open **NPCs**, select **+ New NPC**, add a name, tags/notes, and **Save NPC**. Existing NPC cards reopen their own sheet. Close panels with Escape or their standard close control.
5. Attribute, weapon, NPC attack, and free-roll dialogs persist throws; history supports reroll and removal. NPC checks use the GM free-roll endpoint with the NPC/attack name in the note; they do not claim production NPC combat automation.
6. Switch **View as** to Player to review read-only sheets/NPCs. Table-content controls retain loading, error, empty, and filtered review states. Settings remains an explicitly labelled navigation preview.

Persistence lasts for the prototype backend session, not across a page reload. Character save errors and roll validation/recovery use the production controllers. NPC-only operations report failures without pretending to save.

Endpoint details: [API-CONTRACT.md](API-CONTRACT.md).
