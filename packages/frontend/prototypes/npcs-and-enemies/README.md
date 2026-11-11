# NPC table review

Open **Prototypes / NPCs and enemies / Game table with NPCs** in Histoire.
The shared MSW backend serves production HTTP clients; no running application backend is needed.

1. Use a character card's edit button or the **Character sheets** panel to select a character.
2. Edit the sheet using the production character controller and autosave. Successful saves refresh the table cards.
3. Switch characters using the same tabs as production. Save status and failures follow production behavior; there is no separate Save character button or prototype discard confirmation.
4. Open **NPCs**, select **+ New NPC**, edit its name, rank, level, attribute dice, resources, defenses, attacks and notes, then **Save NPC**. New NPCs default to hidden; set player visibility to hidden, visible (name and rank only), or known (stats shown). Existing fixtures default to known. Switch the story role to Player to review. Notes remain GM-only. Stats are entered manually and do not recalculate when dice, rank or level change. Existing NPC cards reopen their own sheet and display their notes as text. Close panels with Escape or their standard close control. Tags, abilities and damage affinities are hidden for this iteration.

5. Attribute, weapon, NPC attack, and free-roll dialogs persist throws; history supports reroll and removal. NPC checks use the GM free-roll endpoint with the NPC/attack name in the note; they do not claim production NPC combat automation.
6. Switch **View as** to Player to review read-only sheets/NPCs. Table-content controls retain loading, error, empty, and filtered review states. Settings remains an explicitly labelled navigation preview.

Visibility is a UI prototype only: the shared mock API still returns complete NPC records and does not enforce player authorization. A production implementation must filter and redact responses on the server.

The prototype record is not a complete Fabula Ultima model: it lacks NPC type, traits, current attribute dice and champion strength. Crisis and initiative are stored fixture values and are not recalculated or edited. Attack damage type is free text. Production design must decide how to represent and derive these values rather than treating this record as a validated rules schema. Switching NPC tabs or changing role can discard an unsaved NPC draft; the prototype does not yet protect against that.

Persistence lasts for the prototype backend session, not across a page reload. Character save errors and roll validation/recovery use the production controllers. NPC-only operations report failures without pretending to save.

Endpoint details: [API-CONTRACT.md](API-CONTRACT.md).
