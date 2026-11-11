# NPCs and enemies — technical design

**Created:** 2026-11-11

## Technical decisions

- Store NPCs in game-scoped tables, separate from character sheets. Persist manual stats as supplied; do not calculate or store fields outside the [agreed scope](ux.md). Follow the [Fabula Ultima rules](../../spec/fabula-ultima/npcs-and-enemies.md) for rolls.
- Apply visibility projections on the server. The [prototype](../../../packages/frontend/prototypes/npcs-and-enemies/) sends full records and uses shared free rolls; neither contract is suitable for production.
- Extend the existing throw service with NPC-specific setup and GM-only snapshots. This prevents shared history from exposing NPC data; the audience policy requires confirmation before implementation.
- Use game transaction locks, revision checks and idempotent creation to serialize writes and prevent duplicates or lost updates.

## Data structures

### Database

Target PostgreSQL schema; add matching Drizzle declarations in `packages/backend/src/database/schema.ts`. The migration is authoritative.

```sql
CREATE TABLE npcs (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL CHECK (name = trim(name) AND char_length(name) > 0),
  rank text NOT NULL CHECK (rank IN ('Soldier', 'Elite', 'Champion')),
  level smallint NOT NULL CHECK (level BETWEEN 5 AND 60),
  visibility text NOT NULL DEFAULT 'hidden'
    CHECK (visibility IN ('hidden', 'visible', 'known')),
  dex_die smallint NOT NULL CHECK (dex_die IN (6, 8, 10, 12)),
  ins_die smallint NOT NULL CHECK (ins_die IN (6, 8, 10, 12)),
  mig_die smallint NOT NULL CHECK (mig_die IN (6, 8, 10, 12)),
  wlp_die smallint NOT NULL CHECK (wlp_die IN (6, 8, 10, 12)),
  current_hp integer NOT NULL CHECK (current_hp >= 0),
  max_hp integer NOT NULL CHECK (max_hp >= 0 AND current_hp <= max_hp),
  current_mp integer NOT NULL CHECK (current_mp >= 0),
  max_mp integer NOT NULL CHECK (max_mp >= 0 AND current_mp <= max_mp),
  defense integer NOT NULL CHECK (defense >= 0),
  magic_defense integer NOT NULL CHECK (magic_defense >= 0),
  notes varchar(2000) NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX npcs_game_created_idx ON npcs (game_id, created_at, id);

CREATE TABLE npc_attacks (
  id uuid PRIMARY KEY,
  npc_id uuid NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 99),
  name varchar(100) NOT NULL CHECK (name = trim(name) AND char_length(name) > 0),
  reach text NOT NULL CHECK (reach IN ('melee', 'ranged')),
  attribute_1 text NOT NULL CHECK (attribute_1 IN ('DEX', 'INS', 'MIG', 'WLP')),
  attribute_2 text NOT NULL CHECK (attribute_2 IN ('DEX', 'INS', 'MIG', 'WLP')),
  damage_bonus integer NOT NULL,
  damage_type varchar(100) NOT NULL DEFAULT '',
  CONSTRAINT npc_attacks_position_unique UNIQUE (npc_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE npc_create_requests (
  account_id uuid NOT NULL REFERENCES accounts(id),
  request_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL,
  request_body jsonb NOT NULL,
  PRIMARY KEY (account_id, request_id)
);

ALTER TABLE throws ADD COLUMN audience text NOT NULL DEFAULT 'shared'
  CHECK (audience IN ('shared', 'gm'));
CREATE INDEX throws_gm_shared_seq_idx ON throws (game_id, seq)
  WHERE NOT deleted AND audience = 'shared';
```

`npc_create_requests.request_id` equals the requested NPC ID. Store the normalized original `NpcWrite` in `request_body`; compare JSONB values on retry. Keep the receipt independently of NPC updates. A receipt and its NPC are inserted in one transaction. A globally colliding NPC ID returns `id_conflict`, without disclosing the owner. Cascade receipts when their game is deleted, matching character creation receipts.

Attack positions are zero-based array indexes. The deferred unique constraint permits reordering within one transaction. Validate all submitted attack IDs before replacing rows: an existing ID must belong to this NPC; new IDs must not belong to another NPC. Delete omitted attacks and upsert the remainder atomically. The `position` bound enforces at most 100 attacks; service validation also rejects duplicates and noncontiguous order.

### API types

```ts
type Attribute = "DEX" | "INS" | "MIG" | "WLP";
type Die = 6 | 8 | 10 | 12;
type Rank = "Soldier" | "Elite" | "Champion";
type Visibility = "hidden" | "visible" | "known";
type Resource = { current: number; max: number };
type Attack = {
  id: string; // client-generated UUID
  name: string;
  reach: "melee" | "ranged";
  attributes: [Attribute, Attribute];
  damageBonus: number;
  damageType: string;
};
type NpcProfile = {
  name: string;
  rank: Rank;
  level: number;
  baseDice: Record<Attribute, Die>;
  hp: Resource;
  mp: Resource;
  defense: number;
  magicDefense: number;
  attacks: Attack[]; // ordered
};
type NpcWrite = NpcProfile & { visibility: Visibility; notes: string };
type GmNpc = NpcWrite & {
  view: "gm";
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
type VisibleNpc = { view: "visible"; id: string; name: string; rank: Rank };
type KnownNpc = NpcProfile & { view: "known"; id: string };
type NpcRead = GmNpc | VisibleNpc | KnownNpc;
```

All fields are required; UUIDs are strings and timestamps are ISO 8601. Names are trimmed and required, at most 100 Unicode characters; notes are at most 2,000, damage type at most 100, and attacks at most 100. Empty notes and damage type are allowed. Numeric fields are integers within PostgreSQL `integer` range. Reject unknown fields and render text escaped.

## API contract

All paths below start with `/api/games/:gameId/npcs`. Use existing session and write-origin guards. Resolve current game membership server-side; scope every NPC and attack lookup to the game.

| Method | Request | Response |
| --- | --- | --- |
| `GET /` | — | `200 { npcs: NpcRead[] }`, ordered by creation time and ID. |
| `GET /:npcId` | — | `200 { npc: NpcRead }`. |
| `POST /` | `{ id: UUID, npc: NpcWrite }` | `201 { npc: GmNpc }`; identical retry returns `200`. |
| `PUT /:npcId` | `{ expectedRevision: number, npc: NpcWrite }` | `200 { npc: GmNpc }`; replaces the profile and attacks and increments revision. |

Only the GM can write. For players, hidden NPCs are omitted and detail returns 404; visible NPCs return `VisibleNpc`; known NPCs return `KnownNpc`, without GM notes. Apply the same projection to list and detail.

Create uses the client-generated NPC ID as its idempotency key. Compare retries with the original normalized request, not the current edited record. Conflicting reuse returns `409 id_conflict`. Updates check revision and access under the existing game transaction lock; stale updates return `409 stale_revision` without changing data. Return existing error envelopes: `400` malformed request, `401` unauthenticated, `403` unauthorized action, `404` inaccessible game or NPC, and `422 validation` with field paths. Do not disclose hidden or cross-game NPC existence in errors.

## Rolls and history

Extend `POST /api/games/:gameId/throws`, retaining its `{ sourceThrowId, setup }` envelope:

```ts
type NpcAttributeSetup = {
  type: "npc-attribute";
  npcId: string;
  expectedRevision: number;
  attributes: [Attribute, Attribute?];
  dice: Partial<Record<Attribute, Die>>;
  modifier: number;
  redDice: Die[];
  redModifier: number;
  note: string;
};
type NpcAttackSetup = {
  type: "npc-attack";
  npcId: string;
  attackId: string;
  expectedRevision: number;
  dice: [Die, Die];
  modifier: number;
  note: string;
};
```

Use existing throw validation and Fabula resolution. `redDice` contains 0–2 standard dice, notes are trimmed and at most 500 characters, and modifiers are signed 32-bit integers. Omitted attribute dice use the NPC's saved base dice; repeated attributes use the same effective die. The server checks GM access, NPC revision and attack ownership, resolves attack attributes and `floor(level / 10)` accuracy bonus, and generates dice results. Attribute rolls have no automatic attack bonus. Damage calculation and application are out of scope.

Extend the existing `throws.setup` JSONB discriminated union and corresponding backend/frontend types:

```ts
type NpcResolvedSetup = {
  type: "npc-attribute" | "npc-attack";
  kind: ThrowKind; // existing check/roll/weapon-accuracy kinds
  npcId: string;
  npcName: string; // snapshot
  attributes: [Attribute, Attribute?];
  dice: SetupDice[]; // resolved effective sizes and labels
  modifier: number; // manual modifier
  redDice: SetupDice[];
  redModifier: number;
  note: string;
  attack: null | {
    id: string;
    name: string;
    accuracyBonus: number;
    damageBonus: number;
    damageType: string;
  };
};
```

For NPC rows, set `audience = 'gm'`, `character_id` and `equipment_id` to null, `character_name` to the NPC snapshot name and `equipment_name` to the attack name or null. Keep the existing `kind` and `outcome` formats; the response's `setup` carries `NpcResolvedSetup`. Update the history renderer and reroll parser to discriminate `setup.type` instead of interpreting these rows as character rolls. No NPC foreign key is required on historical snapshots.

Filter private throws before pagination; also authorize removal and reroll source lookup. Rerolls remain private, verify current NPC/attack eligibility and revision, and retain the original attack attributes, bonus and damage metadata. Existing shared throws remain unchanged. Never put NPC details in shared free-roll notes or broadcast events. Private rows may leave sequence gaps visible to players; confirm whether that metadata is acceptable.

## Frontend and live updates

- Integrate a dedicated NPC controller and injected API into `GameView`/`GameTable`. Adapt prototype card, sheet and attack views to the production types; production must not import prototype files.
- Keep drafts separate from query data. Do not replace dirty drafts on refetch; retain them on failed or conflicting writes. Connect navigation guards to the interaction specified in [UX](ux.md).
- Update or invalidate list and detail after save. Publish an ID-free NPC invalidation hint after commit; refetch on hint, reconnect and focus. Clear inaccessible data and prevent stale responses from restoring it.
- Send NPC throw hints only to the GM. The existing event stream is in-process without replay or cross-instance delivery; immediate cross-instance revocation requires additional infrastructure. HTTP authorization remains authoritative.

## Verification and open decisions

The handover should cover authorization and visibility transitions, cross-game IDs, revoked membership, concurrent updates, create retries, attack ownership, private throw pagination/removal/rerolls, event payloads, draft preservation and card/sheet synchronization. Test server security against PostgreSQL and prototype flows against shared MSW handlers.

Before implementation, confirm the throw audience policy and whether sequence gaps are acceptable. Multi-instance live-update requirements determine whether shared event delivery is required.
