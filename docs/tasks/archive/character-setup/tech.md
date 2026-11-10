# Character setup — technical design

**Created** 2026-11-05

**Updated** 2026-11-06

**Related** [Story](story.md) · [UX journey](ux.md) · [UI prototype](ui.md) · [Fabula Ultima specification](../../../spec/fabula-ultima/character-spec.md) · [Implementation plan](plan.md)

## Release scope and UI analysis

The MVP lets a single GM create a Fabula Ultima game, add players, and create and edit named characters in place. Calculations use the available inputs and are marked partial. **Active** identifies the character shown on the game overview. The earlier wizard, review, and completion flow belongs to a later rules milestone.

| Screen | Production behavior and differences from the prototype |
| --- | --- |
| Games | Offer Fabula Ultima as the only system. Remove the D&D placeholder from the catalog and supported paths. Open saved Fabula games by ID. |
| Game | Show the player list and each player’s active character. Add a named player and open their page. |
| Player | List named characters and show the active marker. **Create character** requires a name and opens the sheet after acknowledgement. The GM can select or clear the active character independently of creation. |
| Sheet | Reuse the responsive header, paired sections, item editors, dice controls and defense breakdown. Keep editable name, theme, manual level, base dice, resources, named entries, resource maximum and defense overrides, and a browser-local editing lock. Keep removal confirmation for sheet entries and show save status. |
| Future rules-validated flow | Resolve the missing identity/concept, origin and presentation fields before exposing completion. Design catalog-backed class and skill allocation for the rules milestone. Direct die selection can stay if it validates the resulting starting multiset. Plan structured loadout, sourced effects and review feedback before claiming validated creation. |

The manual sheet has a hard two-class cap. Classes and skills are named notes. Equipment prices and weapon accuracy inputs are GM-entered data. Starting cash, budget and equipment eligibility, attacks, advancement and player sign-in are deferred. Deployment assumes a trusted environment operated by one GM.

## Existing implementation and ownership

- [Games backend](../../../../packages/backend/src/modules/games) uses Express, Arrow Express and parameterized PostgreSQL queries. It already returns immutable game system IDs. Add detail retrieval and replace the placeholder catalog entry with `fabula-ultima`. Filter game reads to the supported system and reject creation with the retired ID. Existing placeholder rows are outside the app.
- Add backend `players` and `characters` modules under `src/modules`. Players own the roster and active selection. Characters own identity, sheet writes, and revision. Put the Fabula payload validator, defaults and pure calculations in a Fabula-specific module. Controllers parse HTTP and translate domain errors. Services enforce scope and own transaction boundaries.
- The [frontend router](../../../../packages/frontend/src/main.ts) currently mounts a single games view, with fetch and form state in [GamesView](../../../../packages/frontend/src/modules/games/GamesView.vue). Use controller components for new screens and API adapters at the module boundary. The earlier prototype sheet has been removed; the [production sheet](../../../../packages/frontend/src/modules/characters/sheet/CharacterSheet.vue) is the current component reference.
- The [migration CLI](../../../../packages/backend/src/migrate.ts) and [isolated browser stack](../../../../packages/tests/src/setup.ts) both read only `001_games.sql`. Give both entry points the same ordered migration function.

## HTTP contract

All IDs are UUIDs and timestamps are ISO 8601 UTC strings. In this table, `G` means `/api/games/:gameId`, `P` means `G/players/:playerId` and `C` means `P/characters/:characterId`.

| Method and path | Request | Success |
| --- | --- | --- |
| `GET G` | — | `200 { game }`, using the existing game DTO. |
| `GET G/players` | — | `200 { players: Player[] }`, ordered by `createdAt ASC, id ASC`. |
| `POST G/players` | `{ id, name }` | `201 { player }` on creation, `200 { player }` on replay. |
| `GET P` | — | `200 { player }`. |
| `GET P/characters` | — | `200 { characters: CharacterSummary[] }`, ordered by `createdAt ASC, id ASC`. |
| `POST P/characters` | `{ id, name }` | `201 { character }` with server defaults, `200 { character }` on replay. |
| `GET C` | — | `200 { character }`. |
| `PATCH C` | `{ expectedRevision, changes: SheetChanges }` | `200 { character }` with the new canonical sheet and derived values. |
| `PUT P/active-character` | `{ expectedRevision, characterId: string \| null }` | `200 { player }`. Use a character from this player or send `null` to clear the selection. |

```ts
type Player = {
  id: string;
  gameId: string;
  name: string;
  createdAt: string;
  revision: number; // Active selection version
  activeCharacter: { id: string; name: string } | null;
};

type CharacterSummary = {
  id: string;
  playerId: string;
  name: string;
  level: number;
  createdAt: string;
};

type Character = CharacterSummary & {
  systemId: "fabula-ultima";
  updatedAt: string;
  revision: number;
  sheet: FabulaSheet;
  derived: FabulaPreview;
};
```

- Scope each request to a supported game and check the full parent chain. Invalid UUID syntax or malformed request structure returns `400 bad_request`. A valid ID outside the supported game or its stated parent returns `404 not_found`. Invalid input values return `422 validation`. Keep the `{ error: { code, message, fields? } }` envelope and use JSON Pointer paths for sheet field errors.
- Reuse a client-generated UUID across retries of a player or character create. The initial request sets the name. A replay with the same ID under the same parent returns the current record and preserves later changes, including a character rename. An ID already used under a different parent returns `409 id_conflict`. Handle races with the primary key and a scoped reread. Names can repeat and the UI uses labels without displaying IDs as fields.
- Character saves and active selection use independent revisions on the character and player respectively. Start at zero. Check the revision and commit atomically, incrementing once per change. A matching no-op returns the current revision. A stale revision returns `409 stale_revision`. Active selection starts empty.

## Sheet and calculation contract

```ts
type Attribute = "DEX" | "INS" | "MIG" | "WLP";
type Die = 6 | 8 | 10 | 12;
type NamedEntry = { id: string; name: string; notes: string };
type EquipmentEntry = {
  id: string;
  name: string;
  notes: string;
  priceZenit: number | null;
} & (
  | { kind: "other" }
  | { kind: "weapon"; equipped: boolean; accuracyDice: [Attribute | null, Attribute | null]; accuracyBonus: number | null }
  | { kind: "armor"; equipped: boolean; fixedDefense: number | null; defenseBonus: number; magicDefenseBonus: number; initiativeModifier: number }
  | { kind: "shield"; equipped: boolean; defenseBonus: number; magicDefenseBonus: number; initiativeModifier: number }
);

type FabulaSheet = {
  name: string;
  theme: string | null;
  level: number;
  baseDice: Record<Attribute, Die>;
  classes: NamedEntry[];
  skills: NamedEntry[];
  equipment: EquipmentEntry[];
  resources: { hp: number; mp: number; ip: number; fabula: number };
  overrides: {
    maxHp: number | null;
    maxMp: number | null;
    maxIp: number | null;
    defense: number | null;
    magicDefense: number | null;
    initiative: number | null;
  };
};

type SheetChanges = Partial<Omit<FabulaSheet, "baseDice" | "resources" | "overrides">> & {
  baseDice?: Partial<FabulaSheet["baseDice"]>;
  resources?: Partial<FabulaSheet["resources"]>;
  overrides?: Partial<FabulaSheet["overrides"]>;
};

type Contribution = {
  source: Attribute | "base" | "armor" | "shield";
  entryId?: string;
  value: number;
};

type FabulaPreview = {
  coverage: "partial";
  maxima: { hp: number; mp: number; ip: number };
  defenses: Record<"defense" | "magicDefense" | "initiative",
    | { calculated: number; contributions: Contribution[] }
    | { calculated: null; reason: "ambiguous_equipment" }
  >;
};
```

- The server creates a named level-5 sheet with DEX d8, INS d10, MIG d6, WLP d8, 35 HP, 45 MP, 6 IP, 3 Fabula points, empty lists and null optional fields.
- A patch changes only supplied keys. Merge the three nested maps by supplied keys and replace any supplied entry list in full. Keep entry UUIDs stable across edits. Clearing an optional field uses `null`. Require at least one changed-field key, reject unknown keys and validate the merged sheet. For an equipment kind change, send the new variant and its applicable fields.
- Trim names and require a nonblank value at creation and on rename. Use the existing 20-character player name limit. The proposed sheet limits are 100 characters per character or entry name, 200 for theme, 500 per note, and 100 entries each for skills and equipment. The class limit is two. Accept manual levels 5–50, numeric dice from the declared set, and nonnegative whole resources and prices. Modifiers and initiative may be signed. Bound numeric input to the PostgreSQL signed 32-bit range and return a sanitized `413 payload_too_large` for character requests above 96 KiB.
- The server calculates HP and MP maxima from level and base MIG/WLP. Calculated maximum IP is 6. Class and skill effects are deferred. Current values are independent of maxima and can exceed them. The sheet accepts these values without a warning.
- In the ordinary equipment case, physical Defense starts at DEX or the armor's fixed Defense. Apply armor and shield modifiers in the supplied rules order. Magic Defense starts at INS and initiative at zero. Multiple equipped armor pieces or multiple equipped shields are valid input. In those cases the server returns unavailable defense and initiative calculations and preserves all equipment. Weapon inputs supply accuracy metadata.
- A saved override is the effective value. The sheet shows calculated values or their unavailable state and offers **Use calculated** to clear an override. Label automated numbers as partial.

## PostgreSQL schema and transactions

Keep the existing `games` table. Use relational columns for scalar fields and child rows for each ordered list. Compute the preview from saved inputs. The API still presents one sheet aggregate.

| Migration and table | Columns and constraints |
| --- | --- |
| `002_players.sql` · `players` | UUID primary key, required `game_id` FK, required trimmed nonblank `name varchar(20)`, nonnegative integer `revision` default 0, and `created_at timestamptz`. Index `(game_id, created_at, id)`. |
| `003_characters.sql` · `characters` | UUID primary key, required `player_id` FK, `UNIQUE (player_id, id)`, nonnegative integer `revision` default 0, and `created_at` and `updated_at` timestamps. Required trimmed nonblank `name varchar(100)`, nullable `theme varchar(200)`, required `level smallint` checked to 5–50, and required `dex_die`, `ins_die`, `mig_die`, `wlp_die` checked to 6, 8, 10 or 12. |
| `characters` · resources and overrides | Required nonnegative integers `current_hp`, `current_mp`, `current_ip`, `fabula_points`. Nullable nonnegative integer overrides `max_hp_override`, `max_mp_override`, `max_ip_override`. Nullable integer overrides `defense_override`, `magic_defense_override`, `initiative_override`. Index character list reads by `(player_id, created_at, id)`. |
| `character_classes` | UUID primary key, required `character_id` FK, required trimmed nonblank `name varchar(100)`, and `notes varchar(500) NOT NULL`. Required `position smallint` checked to 1 or 2, unique per character. |
| `character_skills` | Same identity, ownership, name and notes constraints as classes. Required position from 1 to 100, unique per character. |
| `character_equipment` | Same identity, ownership, name, notes and position constraints as skills. Required kind from `other`, `weapon`, `armor`, or `shield`. Nullable nonnegative `price_zenit`. Typed columns for `equipped`, `accuracy_attribute_1`, `accuracy_attribute_2`, `accuracy_bonus`, `fixed_defense`, `defense_bonus`, `magic_defense_bonus`, `initiative_modifier`. Use a row check to enforce the equipment variants described below. |
| `003_characters.sql` · active selection | Add nullable `players.active_character_id` with `FOREIGN KEY (id, active_character_id) REFERENCES characters(player_id, id)`. A null pointer represents no active selection. |

Child rows use `ON DELETE CASCADE` from the sheet. Name checks enforce both trimmed text and at least one non-whitespace character. The player and character names have no uniqueness constraint. Each list is read in position order. The two numbered class positions enforce the limit in the database.

Equipment variant checks require `equipped` for weapons, armor and shields and use null for fields outside the selected variant. Weapon accuracy attributes may be unset and each supplied attribute must be DEX, INS, MIG or WLP. Armor and shields require the three integer modifiers. Only armor may carry a fixed physical Defense. There is no unique equipped-item constraint.

- Use one transaction per sheet mutation. Lock the scoped character row, check its revision, read current inputs, merge and validate, then write changed scalar fields and replace only the supplied child lists. Preserve their entry IDs and assign positions from request order. Update the revision and timestamp together. Read a consistent aggregate for the response. Use a single statement or a consistent transaction snapshot for standalone aggregate reads.
- Lock the player row when changing or clearing active selection. Check the player revision and rely on the composite FK to prevent cross-player assignment. Join the selected name into the roster and player summaries.
- Run the same Drizzle migrator in the CLI and isolated browser test stack. Serialize migration runs per schema and keep Drizzle's migration history in that schema. Drizzle applies pending migrations and their history entries in a transaction. The migration history starts on a fresh database; it does not import the former custom ledger.
- Before adding rules validation, define the catalog version and explicit mapping from manual entries to sourced rules data.

## Frontend interfaces and optimistic saves

Use routes `/`, `/games/:gameId`, `/games/:gameId/players/:playerId` and `/games/:gameId/players/:playerId/characters/:characterId`. Derive context from route IDs and saved names. Direct links and reloads fetch the same record. Keep responsive sidebar and slideover navigation, translated labels, and stable `data-testid` selectors.

| Layer | Responsibility |
| --- | --- |
| Module `api.ts` | Define typed request functions for every endpoint used by the flow, including existing game and system calls. Keep URLs, methods, bodies, response mapping and HTTP error classification here. Share the low-level JSON transport. |
| Module query and mutation composables | Wrap every request in an application Vue hook, such as `useGame`, `usePlayers`, `useCreateCharacter`, or `useUpdateCharacter`. Own query keys, enabled conditions and invalidation. Feature controllers call these hooks. |
| Shared `useOptimisticSave` | Wrap TanStack Vue Query mutations for reusable optimistic edits. Own serial dispatch, pending input, acknowledgement and failure policy. Accept typed apply and save functions from module hooks. |
| Controllers and views | Controllers coordinate hooks, routes and local preferences. Views receive display data and emit edit intents. Read and write the sheet's editing lock through `localStorage`, keyed by character ID. The lock governs that browser's edit controls. |

TanStack Vue Query owns server cache and mutation lifecycle. Use its retry option for transient read failures and retry-safe create requests that reuse the original ID. Keep conditional sheet and active-selection writes on the revision they were dispatched with. A conflict requires a fresh read, and a write based on a newer revision requires new user intent. [TanStack Vue Query optimistic updates](https://tanstack.com/query/latest/docs/framework/vue/guides/optimistic-updates) · [TanStack Vue Query mutations](https://tanstack.com/query/latest/docs/framework/vue/guides/mutations)

1. Track the acknowledged server snapshot separately from pending input. Apply input immediately in the view and use one in-flight request per record, coalescing later edits. Assign the revision when dispatching from the last acknowledged state. When calculations depend on a pending edit, mark the previous preview as updating until the server supplies the new result.
2. On success, update the cached snapshot and keep newer input over it. Refresh character and player summaries after a confirmed rename or active-selection change.
3. On a known rejection, roll back the affected optimistic input and show the error. On a conflict or uncertain result, pause that record's pending saves and fetch its authoritative state before continuing. Use that snapshot for display and ask the GM to re-enter rejected changes if needed. If refresh also fails, show that saved state could not be confirmed and allow the refresh to be retried.
4. Keep in-flight work tied to its record so a response cannot update a different sheet after navigation. A submitted request can finish after leaving its screen. Failed drafts need no recovery across navigation, reload, or browser restart. Only the editing lock uses local storage.
