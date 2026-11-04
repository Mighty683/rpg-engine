# Character setup — reusable primitives and persistence specification

**Created:** 2026-11-04  
**Scope:** System-independent character setup primitives, validated against the supplied Fabula Ultima PC specification. This document is input to a later PostgreSQL/Drizzle schema, not an implementation plan.

## Requirements and evidence

- Characters must be reusable across RPG systems without turning Fabula Ultima's attributes, classes, resources, slots, or formulas into universal columns.
- Persist player decisions, permanent inputs, mutable play state, and creation evidence separately from catalog definitions and computed results.
- Support incomplete drafts, deterministic validation/calculation, and explicit rules versions.
- The supplied `Fabula_Ultima_PC_Character_Spec.md`, §§1–8, provides the mechanical requirements for the first system. Its §9 model is a proposal, not a required engine architecture. Relevant constraints are restated below so this design does not depend on the temporary upload path.
- The full rulebook and companion skill index were not supplied for this task. Individual skill/spell effects, full item catalogs, and heroic-skill eligibility remain unverified; do not invent them.
- At the time of this proposal no story, UX, UI, or implementation plan existed. The restarted [story](story.md) and [UX journey](ux.md) now define the GM flow; this technical proposal has not been reconciled with them. No additional user research is claimed.

## Repository findings

These findings are historical and no longer describe the current game-creation implementation. Reinspect the repository before relying on the proposal.

- `packages/frontend` contains a Vue placeholder, with no character setup flow or domain model.
- `packages/backend` declares Express, Arrow Express, PostgreSQL, and Drizzle dependencies, but has no server, source modules, schema, migrations, or tests.
- No architecture specification or existing character contracts were found. Module boundaries below are proposals.
- Follow [code conventions](../../spec/code-conventions.md), [testing conventions](../../spec/testing.md), and the multi-system and personal-scope requirements in [UX guidance](../../spec/ux.md).

## Design boundary

Use a small relational character aggregate, versioned rule definitions, and validated system-owned payloads where structures genuinely differ. Do not build an unrestricted entity-attribute-value engine, arbitrary formula language, or generic workflow designer.

The shared model defines **what a fact is**: a narrative value, base stat, selected option, owned item, resource balance, relationship, or active effect. The rules package defines **what it means**: required fields, allowed values, rank limits, acquisition rules, formulas, stacking, permissions, equipment restrictions, and advancement.

A character is bound to one rules configuration at a time. Reuse across systems means reusing these primitives, not silently converting an existing character into another system. Cross-system conversion needs a separate explicit migration/import contract.

### Proposed responsibilities

| Module | Responsibility |
| --- | --- |
| `packages/backend/src/modules/rules` | Resolve immutable catalog/configuration releases; validate definitions and extension payloads; expose the matching system evaluator. No character ownership decisions. |
| `packages/backend/src/modules/characters` | Own the aggregate, drafts, choices, inventories, balances, creation evidence, validation, calculations, and atomic state changes. System-specific calculations live behind the rules boundary. |
| `packages/backend/src/modules/character-access` | Enforce character controller and GM/campaign authority, using future identity/campaign contracts. Actor identity is supplied by authentication, never trusted from a request body. |
| `packages/frontend/src/modules/character-setup` | Render relevant fields and selections, preserve drafts, show validation and previews. Server validation remains authoritative. |

Start with these responsibilities; a new module does not imply a new workspace package. Campaigns, parties, users, and world entities are external references, not character-owned copies. Their persistence contracts do not exist yet.

## Primitive contracts

All IDs below describe logical identity, not final SQL names. Use opaque instance IDs, stable machine keys for definitions, and separate display labels. Labels/translations are never foreign keys. Definition keys are scoped to a rules release; instance references must resolve within their character unless a relationship explicitly targets an external entity.

### 1. Rules configuration and definitions

- **System:** Stable system key, such as `fabula_ultima`.
- **Rules release:** Immutable identified catalog release with content digest, evaluator compatibility version, source references, and support status. Contains stat, field, resource, option, item, slot, relationship, and effect definitions.
- **Rules configuration:** Immutable reference to a release plus an ordered set of explicit versioned campaign overrides. Each override records scope, rationale, authority, and approval evidence. Changing the configuration creates a new configuration ID.
- **Definition:** Stable key, kind, label, source, typed payload contract/version, and completeness status. A missing effect is `not_implemented`, not an empty effect presumed to do nothing.
- **Source reference:** Document/edition and printed page or section. Keep provenance distinct from executable mechanics; do not store a rulebook transcription by default.

Every character pins a rules configuration. Related definition references must resolve through that configuration. A rules correction or evaluator change must not silently change saved characters: use an explicit validated migration. Preserve old releases for existing characters. Never execute code, SQL, or arbitrary expressions supplied in a character payload.

### 2. Character and setup state

Character fields: ID, character kind defined by the system, rules configuration ID, controller reference, optional campaign/party references, display name, lifecycle (`draft`, `active`, `archived`), optimistic revision, and creation/update timestamps.

Creation state records the selected creation procedure/version, starting context, explicit exceptions, and finalization evidence. Procedure position is UI progress, not proof of validity. A draft may omit required narrative values or have an illegal class allocation; it must still have valid types, resolvable supplied references, authorization, and bounded payload sizes. Preserve valid incomplete inputs instead of inventing defaults to satisfy finalization.

Display name can be absent in a draft and required at finalization by the system. Never assume level, ancestry, class, alignment, species, or a party is mandatory for every system. Player-character support comes first; these primitives do not establish complete NPC support.

### 3. Narrative field

An authored value identified by a field-definition key, with a typed value such as text or `{ label, details?, entityRef? }`. Examples: pronouns, appearance, concept, motivation, origin, background.

Keep the character's display name on the character itself. Store additional presentation and narrative values through definitions. Narrative choices have no automatic numeric effect. A system can explicitly associate a selected background option with grants; free-text origin must not implicitly become a species package.

### 4. Base stat and derived stat

A stat definition declares value kind, role, bounds, and any ordered domain. Persist authored/permanently advanced **base inputs** only. Supported initial value kinds:

- `number`: finite integer or fixed-scale decimal as explicitly declared by the definition.
- `die`: face count belonging to a declared ordered die domain; this is a die size, not a roll result.

Derived values are a read projection, with definition key, typed value, and contribution/source explanation. An effective/current die is derived, not a second mutable base stat. Derived level, defenses, capacities, thresholds, and relationship strength must not become competing writable sources of truth.

No global attribute list, d20 modifier, proficiency bonus, die range, nonnegative-stat rule, or universal level formula exists in the shared model. Add more stat kinds only for an actual supported rules requirement.

### 5. Resource balance

A resource definition specifies units, numeric precision, lower bound, optional derived capacity, and transition policy. A character resource stores its mutable current amount. HP, MP, IP, currency, XP, and Fabula Points are different definition keys, not columns on the character.

Capacity and current amount are independent. Initialization can fill a resource; recalculation cannot silently heal, refill, spend XP, or regenerate cash. Unbounded resources have no fabricated maximum. If a state change reduces capacity below current amount, the system must specify clamp/preserve/reject behavior; return the consequence before committing. Fabula's capacity-reduction policy is not settled by the supplied extract.

Currency uses declared smallest units or exact decimal precision, never binary floating-point arithmetic. A setup purchase budget is historical creation state, not the character's live wallet.

### 6. Selection and acquisition

A persisted selection represents an authored acquisition: ID, option-definition key, optional parent selection ID, acquisition context, and schema-validated parameters. Definitions categorize options, for example class, skill, spell, feat, background, or heroic skill; these categories do not become mandatory character fields.

Repeatable choices are separate acquisition instances. Compute rank by counting acquisitions according to the definition, rather than persisting both rank totals and a purchase history. A class selection can own skill-rank selections; Fabula class level derives from those owned rank acquisitions. Class-free benefits are applied once per class selection, not per child selection.

Parent relationships form an acyclic tree inside one character. Validate parent kind, option membership, duplicate policy, prerequisites, and parameter payloads. Parameters can identify choices such as a learned spell or preferred dice. Preserve each purchase's parameters even when several acquisitions contribute to one rank.

**Grants/capabilities** are derived from selections, items, and effects, with source-instance references. Do not persist a second editable list of entitlements or automatically learned abilities. When a grant requires a player decision, persist that decision under its source acquisition; when it creates mutable state, persist an attached component. Removing a source invalidates dependent choices/state rather than leaving orphaned capabilities.

### 7. Attached component

A versioned, definition-validated structured payload tied to a source selection or item. Use for state that does not fit another primitive, such as gadget configuration or a bound-Arcanum choice. Reuse explicit entity references for companions/projects if those domains exist; do not place independent full character sheets inside opaque JSON.

Components are a bounded extension point, not an unrestricted `extra` object. Their definition declares schema, ownership, supported evaluator, and lifecycle. Unknown/unimplemented component mechanics block full mechanical validation, rather than being ignored.

### 8. Item instance and placement

- **Item instance:** ID, item-definition reference, optional custom label, source/acquisition context, and validated instance state. Distinct instances remain distinct even when based on the same catalog entry.
- **Placement:** Relation between an item instance and zero or more equipment slots. Inventory is ownership; equipped state is placement, not a second item collection.
- **Slot definition:** System-defined key, capacity, compatible categories, and occupation rules. A two-handed item occupies both hand slots using the same instance ID.

Catalog price is not necessarily purchase price. Record actual starting purchase prices in creation evidence. Unequipped items do not emit equipped effects; explicitly marked carried effects may do so in systems that support them. Do not impose encumbrance, ammunition, stack sizes, or Fabula's four slots globally. The initial model uses individual item instances; stack/container abstractions are deferred until required.

### 9. Relationship

A relationship has ID, relationship-definition key, an entity reference **or** an authored unresolved target label, selected facets, and optional authored notes. Entity references retain their domain/kind; a label alone cannot prove two targets are distinct.

Definitions own limits, target restrictions, facet vocabulary, mutually exclusive groups, and strength calculation. Fabula Bonds are one application. No shared six-relationship limit or universal emotion enum exists. Resolve self-target checks through entity identity; unresolved targets require later resolution and cannot bypass system restrictions during finalization.

### 10. Active effect

Persist active condition/temporary-effect instances with definition key, source reference, validated parameters, application context, and optional structured expiry. An expiry identifies a supported clock/event basis; a display string is not an executable duration. Permanent input changes are not temporary effects.

The rules evaluator owns duplicate policy, stacking groups, ordered stages, priorities, floors, caps, and conditional activation. An active condition is one effect instance, not an additional independently applied status row. Immunities and damage affinities are normally derived from their sources; scenario-specific overrides require explicit authorized evidence.

### 11. Creation evidence and change provenance

Persist creation decisions that cannot be reconstructed from today's live sheet: starting allocation/profile, purchases and actual prices, injected/entered roll outcomes, procedure version, approval references, and a finalized source snapshot. Record who supplied a roll and its individual die results; this establishes provenance, not proof of fair physical rolling.

Successful mutations record actor, command kind, previous/new revision, rules configuration, and consequential source changes. Finalization and advancement additionally retain the inputs needed to validate those transitions. This is targeted audit/history, not event sourcing: current source rows remain authoritative.

## Relational mapping for the later schema

The following are logical relations, not approved table names or SQL. Use normalized rows for identity, relationships, ownership, and frequently queried facts. Use versioned JSONB only for typed system-owned parameter structures and historical snapshots.

| Logical relation | Key relationships and persisted data |
| --- | --- |
| Rules releases/configurations/overrides | Immutable identity, digest/version, release binding, ordered overrides and approvals. |
| Rule definitions | Unique `(release, kind, key)`; source references, payload contract/version, support status. Overrides resolve through the pinned configuration. |
| Characters | Rules configuration FK, lifecycle, controller/context references, revision, timestamps. |
| Character creation | One per character; procedure, starting context/evidence, optional finalized snapshot. |
| Narrative values | Unique `(character, field definition)`; typed authored value. |
| Base stat values | Unique `(character, stat definition)`; typed numeric or die input. |
| Resource balances | Unique `(character, resource definition)`; exact current amount. |
| Selections | Instance ID, character, option definition, parent selection, acquisition context, typed parameters. |
| Attached components | Instance ID, character, source instance, component definition/version, validated state. |
| Item instances | Instance ID, character, item definition, instance label/state, acquisition reference. |
| Equipment placements | Character, slot definition/position, item instance. Allow one item to occupy multiple slots; enforce slot capacity. |
| Relationships | Instance ID, character, definition, typed entity reference or unresolved label, validated facets/notes. Normalize facets if query/integrity needs warrant it. |
| Active effects | Instance ID, character, definition, source, parameters, structured expiry. |
| Character changes | Character, revision, actor, command, rules context, transition evidence. |

### Integrity and deletion

- Use database constraints for PK/FK identity, required scope, uniqueness, finite/tagged value shape, valid lifecycle, nonnegative revision, and supported numeric precision. Choose concrete types/IDs during schema design.
- Enforce same-character parent, source, and equipped-item ownership through scoped/composite references where possible. Use typed source references; a free-text `sourceId` must not point ambiguously at any table.
- Use application rules validation for semantic constraints: starting arrays, parent membership, slot compatibility, prerequisites, aggregate budgets, relationships, stacking, and system-specific resource bounds. JSON schema checks alone cannot establish these rules.
- Catalog references are restricted from deletion while in use. Archive characters in ordinary operations; do not silently cascade-delete characters when a controller, campaign, party, or world target is removed.
- A later explicit character purge may cascade owned source rows, subject to an agreed audit-retention policy. Removing selections/items through commands must handle dependent choices, placements, and effects atomically.
- Campaign/user/world references need actual FKs once those schemas exist. Arbitrary UUIDs are not a substitute for referential integrity or authorization.
- A computed cache, if later justified, is disposable and keyed by character revision, rules configuration/digest, and evaluator version. Never use it as the sole persisted sheet or as authority for writes.

## Calculation and command boundary

The backend exposes one validation/calculation boundary per pinned rules configuration, conceptually:

```text
validateSource(source, rules, mode) -> structured issues
derive(source, rules) -> immutable projection + contribution trace
validateTransition(before, candidate, context, rules) -> issues + consequences
```

These are pure functions, without database access, ambient time, or random generation. Rolled values and any time/session context are explicit inputs. A preview with incomplete or unsupported rules reports unresolved values; it must not substitute zero or claim full validity.

Command flow: authenticated actor → authorize scope → load source/configuration → check expected revision → construct candidate → validate structure/references → derive → validate semantic and transition rules → atomically persist source and audit evidence → return the new revision, projection, and structured issues.

- Draft save permits incompleteness but not malformed input, forged grants, unknown references, or unauthorized approvals. Finalization requires all required choices and mechanically relevant definitions to be supported, then initializes resources exactly once and records the snapshot in the same transaction.
- Use optimistic revision checks plus transaction/locking semantics to prevent concurrent lost updates, overspending, or duplicate finalization. Retries of a successful transition must not reroll, initialize again, or duplicate acquisition rows; use request idempotency identity for non-repeatable transitions.
- Active-character edits must preserve valid state. No arbitrary CRUD of derived stats, granted capabilities, ranks, or balances without the relevant command validation. Corrections/respecs are explicit authorized transitions, not silently re-running creation.
- Validation issues include stable code, source/selection path, blocking severity, and relevant definition/source references. Distinguish incomplete input, invalid selection, unsupported mechanics, version mismatch, and stale revision.
- UI and future AI actions use the same command/authorization boundary. Prompting an agent must not confer database access or GM authority.
- Do not return another player's private character data through previews, target resolution, or validation errors. Exact permissions depend on the still-missing identity/campaign foundation.

## Fabula Ultima mapping and invariants

| Fabula concept | Shared representation and system-owned rule |
| --- | --- |
| Identity, theme, origin | Narrative fields; theme can carry label/details, origin an optional world reference. Not automatic combat modifiers. |
| DEX, INS, MIG, WLP | Four `die` base stats; ordered domain `[6, 8, 10, 12]`. Creation profile is evidence and must match one allowed multiset: `[8,8,8,8]`, `[10,8,8,6]`, `[10,10,6,6]`. |
| Classes and skills | Distinct class selections with child skill-rank acquisitions. Initially 2–3 classes and exactly five ranks, each class receiving at least one. Validate skill membership, variable caps, prerequisites, and per-purchase parameters. |
| Class levels/total level | Derived child rank count and sum, not independent writable integers. Class benefits apply once per distinct class; cumulative skill effects apply once at resolved rank, not again per acquisition record. |
| HP, MP, IP | Current resource balances. Capacities: `level + 5 × base MIG + modifiers`, `level + 5 × base WLP + modifiers`, `6 + modifiers`. Crisis is `floor(maxHP / 2)`. Initialization fills each once. |
| Fabula/XP/zenit | Separate balances: initially 3 Fabula, 0 XP, and recorded starting cash. No invented hard Fabula cap. Zenit is integer currency. |
| Class benefits/capabilities | Catalog-sourced HP/MP/IP contributions and separate martial/ritual/project grants. Ritual permission does not grant every ritual discipline. |
| Equipment | Item instances placed in armor, main hand, off hand, accessory. Two-handed weapons occupy both hands. Martial melee/ranged/armor/shield entitlements are distinct; overrides need an explicit source. |
| Defenses/initiative | Derived projection: armor may replace the physical-defense base rather than add to it; shields and other applicable modifiers follow the system order. Magical defense normally uses current INS. Negative initiative is valid. |
| Statuses | Active effects with nonstacking duplicates of the same status. Different statuses can stack tier reductions; current dice floor at d6 and cap at d12. Temporary changes never alter base-die HP/MP capacities. |
| Affinities | Derived per-damage-type relationship; absent contribution means normal. Vulnerable/resistant/immune/absorbing and resolution order belong to this system. |
| Bonds | Relationship definition with at most six active entries, no self-target, and 1–3 facets: at most one from each admiration/inferiority, loyalty/distrust, affection/hatred pair. Strength equals facet count; creation of a new Bond starts with one. No mandatory starting Bonds. |
| Spells/Arcana/gadgets/companions | Source-linked choices, grants, and attached state/references only when supported by acquired abilities. Do not treat illustrative payload names as complete rule definitions. |

### Starting purchases and rolls

Record a 500-zenit purchase budget, purchase lines and actual prices, each cash die in `1…6`, actor/source of roll entry, and any exception approvals. Final cash is `500 - purchase total + 10 × (die1 + die2)`. Validate ordinary purchases against supported common weapon/armor/shield definitions; rare/custom exceptions require explicit approval.

Current equipment and wallet subsequently change independently of these historical purchases. Loading, changing a name, or re-equipping an item never re-applies purchases or rolls. Do not infer the starting budget spent from the current inventory.

### Advancement compatibility

Retain acquisition context and transition evidence so later advancement can enforce total level ≤50, class level ≤10, at most three simultaneously unmastered classes, and exactly one ordinary rank per level. Mastery at class level 10 grants an additional eligible heroic-skill selection, not a replacement for the ordinary purchase.

The standard transition spends 10 XP, permits at most one advancement per session, retains excess XP, and does not refill current HP/MP. Record session identity when enforcing this rule. Attribute tier increases occur on crossing total level 20 and 40 exactly once. Later level changes must not revalidate the original starting dice array against advanced base stats; use creation evidence for historical checks.

Higher-level starts follow valid level-5 creation and supported advancement. The optional `500 + 50 × (level - 5)` equipment-budget recommendation is explicit creation policy, not automatic advancement income. Full advancement behavior is future work; persistence must not preclude it.

## Decisions and tradeoffs

1. **Hybrid relational model over a single JSON sheet or unrestricted EAV.** Keeps ownership and references enforceable while permitting validated system-specific choices. Costs explicit validators for each extension.
2. **Acquisition instances over duplicated rank/level counters.** Preserves purchase-time choices and avoids drift. Costs aggregation and system validation; importers must construct acquisitions rather than trust rank totals.
3. **Pinned definitions/evaluator over live catalog updates.** Makes reloads reproducible. Costs release retention and deliberate migration tooling.
4. **Derived grants/projections over writable final sheets.** Prevents double counting and stale derived values. Requires reliable deterministic calculation and source explanations.
5. **System evaluators over a universal rules language.** Reuses storage and contracts without pretending all rule ordering is additive. Supporting new mechanics can require evaluator code, not just catalog data.
6. **Historical creation evidence over reconstructing setup from live state.** Supports audit and later play without freezing current equipment or currency. This is not a full combat/session event log.

## Verification requirements

Use Vitest per repository conventions. Organize unit cases around inputs with related assertions, and browser tests around complete journeys. No runner or tests are implemented yet.

- Shared-model cases: partial draft save/reload, malformed tagged values, invalid references, cross-character item/source links, parent cycles, unknown component schema, resource precision, missing permissions, stale revision, atomic rollback, and duplicate finalization retries.
- Rules reproducibility: pin old definitions, publish a changed release without altering existing projections, reload deterministically, and reject unsupported mechanics or incompatible evaluators. Prove derived/granted values cannot be forged through writes.
- Fabula fixture: DEX=8, INS=10, MIG=6, WLP=8; orator two ranks and weaponmaster three. With no other skill modifiers, expect HP=40, MP=50, IP=6, Crisis=20, Defense=8, Magic Defense=10, Initiative=0. Until full skills are sourced, label this a calculation fixture, not a fully validated playable character.
- With traveler garb and runic shield, expect Defense=11, Magic Defense=13, Initiative=−1. Buying rapier/garb/shield for 200/100/150 leaves 50; recorded dice `[2,4]` yield 110 cash. Reload or equip changes do not reroll or reset cash.
- Starting single-class allocation fails; rogue/wayfarer/tinkerer bonuses produce IP=12. Rank caps, mismatched class skills, missing parameters, and unsupported full skill effects block finalization.
- Status cases: slow changes current DEX but not max HP/MP; dazed plus enraged stack on INS with floor d6; duplicate dazed does not stack. Fixed armor ignores DEX for its replaced physical-defense base.
- Relationship/loadout cases: conflicting emotions and self-Bonds fail; two legal facets give strength two; a two-handed weapon plus a shield fails absent a supported override.
- Transition cases: crossing 19→20 changes one base die, 20→21 does not; mastery adds both ordinary and heroic choices; a fourth unmastered class fails; advancement preserves current HP/MP and historical starting evidence.
- Non-Fabula structural fixture: a deliberately synthetic, classless and level-less rules release with numeric attributes, differently named resources, and different slots uses the same primitives without Fabula-specific columns. This verifies representation only, not support for a real second RPG system.
- Browser journey when implemented: create incomplete draft → reopen → complete choices → see actionable errors/preview → finalize once → reopen without changed rolls or resource initialization. Test stale concurrent edits and denied writes without duplicating calculation unit cases.

## Blockers and remaining decisions

- Source the missing skill index and full mechanically relevant skill/spell/item/heroic definitions before claiming complete Fabula creation or advancement support. Representative items and class bonuses alone are insufficient.
- Settle resource-capacity reduction behavior, respec/correction permissions, and treatment of unresolved relationship targets before exposing those transitions.
- Define identity, controller/GM permissions, campaign/party/world references, and approval authority. Do not expose multi-user writes before these boundaries exist.
- Select concrete ID types, JSON validation tooling, rule-release packaging/evaluator compatibility mechanism, and audit retention when producing the physical schema. Preserve the logical contracts above.
- Bootstrap backend/persistence/test tooling separately. This document neither creates migrations nor authorizes implementation or agent dispatch; sequencing belongs in the implementation plan.
