# Fabula Ultima — Player Character Profile & Creation Specification

**Purpose:** Hand this document to a coding AI agent implementing the **player-character (PC)** model, creation wizard, validation, and stat recalculation in an RPG engine.

**Source:** User-provided Polish *Fabula Ultima* Core Rulebook (2024). Primary printed pages: 34–37 (character anatomy), 56–57 (Bonds), 92–94 (damage affinities and statuses), 122 (equipment slots), 154–171 (character creation and starting equipment), 176–215 (classes), 226–229 (advancement). Printed page numbers are two less than PDF page numbers.

**Scope:** Core-rulebook PCs, normally beginning at level 5. This is a **condensed implementation specification**, not a transcription of every skill/spell/item effect. A companion `Fabula_Ultima_Core_Skill_Index.json` was described as listing all 75 class-skill names and rank limits, but is not available in this repository and does **not** contain their effects. Full rules for each individual skill and spell must be entered into rule catalogs from the relevant book pages before claiming full mechanical support. Do not fabricate missing effects.

**Notation:** d6/d8/d10/d12 = dice with that many faces. `DEX` = Zręczność (ZR), `INS` = Wejrzenie (WJ), `MIG` = Potęga (PO), `WLP` = Siła Woli (SW); HP = Punkty Życia; MP = Punkty Mocy; IP = Punkty Ekwipunku; Fabula = Punkty Fabuli; zenit = ZNT; skill rank = `PU` (poziom umiejętności). The English aliases in this file are **engine identifiers**, not official translated nomenclature.

---

## 1. Canonical character-creation procedure

A creation wizard may allow users to revisit steps; persist a draft until all mandatory constraints validate.

1. **Identity (Tożsamość):** Free-text, short narrative self-description/concept. Not a mechanical class, species, or race.
2. **Theme (Motyw):** A defining motivation, idea, or emotion. Can select a suggested theme or write one. Examples from the book include hope, justice, revenge, duty, and ambition. Store both a short theme label and an optional explanation.
3. **Origin (Pochodzenie):** Fictional location/community of origin, normally from the collaboratively built campaign world; may be new. It is a narrative trait, **not** a racial ability package.
4. **Starting classes:** Character starts at **level 5**. Choose **2 or 3 distinct classes** from the 15 core classes. Distribute exactly **5 class levels** between them, each chosen class receiving at least 1. Each class level grants **one skill acquisition/rank**, and acquiring a class grants its **free class benefits once**, not once per level.
5. **Attributes:** Select **one** allowed starting dice array and assign its four dice to DEX, INS, MIG, WLP (see §3).
6. **Derived stats:** Compute maximum HP/MP/IP, Crisis threshold, physical Defense (`Pancerz`), magical Defense (`Magiczny Pancerz`) and Initiative modifier (`modyfikator inicjatywy`). Apply class, purchased skill, and equipment effects.
7. **Starting equipment:** Allocate **500 zenits** to permitted starting purchases, then generate initial available cash as **unspent equipment budget + (2d6 × 10) zenits**. Apply equipment loadout effects. Rules for exceptional items require table/GM approval.
8. **Presentation:** Supply character name, pronouns, and short visual description. These are presentation/narrative fields, not numeric modifiers.
9. **Initialization:** Start with **3 Fabula Points**; HP, MP and IP initially equal their calculated maximums. No default Bonds/status ailments need to be invented.

**Creation prerequisites:** The campaign world and party concept normally precede character creation (printed pp. 146–153), but the PC model should store references to them rather than forcing a fixed world or party archetype.

## 2. Class catalog: free benefits

The rulebook has 15 core classes. These free effects apply **once upon first acquiring that class**, even if multiple starting levels are invested. Bonuses from **different** classes stack. All 15 have five class skills, some with multi-rank caps; keep these in a separate rules catalog.

| Class ID (suggested) | Original name | Once-per-class benefit | Additional entitlement |
|---|---|---|---|
| `chimerist` | Chimera | +5 maximum MP | Ritualism rituals |
| `darkblade` | Córa Cienia | +5 maximum HP | Martial melee weapons and martial armor |
| `elementalist` | Elementalistka | +5 maximum MP | Ritualism rituals |
| `fury` | Furia | +5 maximum HP | Martial melee weapons and martial armor |
| `rogue` | Łotrzyca | +2 maximum IP | — |
| `entropist` | Mag Chaosu | +5 maximum MP | Ritualism rituals |
| `spiritist` | Medium | +5 maximum MP | Ritualism rituals |
| `weaponmaster` | Mistrz Broni | +5 maximum HP | Martial melee weapons and martial shields |
| `loremaster` | Mistrz Wiedzy | +5 maximum MP | — |
| `arcanist` | Mistyczka | +5 maximum MP | — |
| `orator` | Mówcze | +5 maximum MP | — |
| `guardian` | Obrońca | +5 maximum HP | Martial armor and martial shields |
| `sharpshooter` | Strzelczyni Wyborowa | +5 maximum HP | Martial ranged weapons and martial shields |
| `wayfarer` | Wagabunda | +2 maximum IP | — |
| `tinkerer` | Złota Rączka | +2 maximum IP | May start Projects |

**Important:** Class *free benefits* and class *skill effects* are different sources. For example, a Guardian receives +5 HP merely for taking the class, while a separately purchased skill may increase HP further. Do not apply a class-free bonus per class level. Ritualism permission does **not** automatically grant every school-specific ritual: school-specific capabilities come from appropriate skills.

## 3. Attributes and permitted starting arrays

Choose exactly one array, then permute its dice across the four attributes:

| Profile | Dice multiset |
|---|---|
| Generalist (`generalist`) | d8, d8, d8, d8 |
| Balanced (`balanced`) | d10, d8, d8, d6 |
| Specialist (`specialist`) | d10, d10, d6, d6 |

- All four stored **base attribute dice** must exactly match the selected multiset (in any order). These are **dice sizes, not rolled values**.
- Allowed dice tiers are `[6, 8, 10, 12]`; starting arrays do not include d12.
- Keep **base** and **current** dice distinct. Temporary conditions/effects alter the current dice; only permanent advancement affects base dice.
- No automatic racial/species modifiers, fixed D&D-style ability scores, ability-score point-buy, or proficiency bonus are defined by these rules.
- Derived HP/MP maxima use **base** MIG/WLP die sizes; Defense normally uses **current** DEX/INS die sizes.

## 4. Derived statistics

At creation, **before** other effects:

```text
level = sum(class.level for class in classes)        // exactly 5 at creation
baseMaxHP = level + 5 * baseDice.MIG
baseMaxMP = level + 5 * baseDice.WLP
baseMaxIP = 6
baseDefense = currentDice.DEX
baseMagicDefense = currentDice.INS
baseInitiativeModifier = 0
```

Resolve **stacking class bonuses**, followed by skill and equipment bonuses in the applicable manner:

```text
maxHP = baseMaxHP + classHPBonus + skillHPBonus + otherHPBonuses
maxMP = baseMaxMP + classMPBonus + skillMPBonus + otherMPBonuses
maxIP = baseMaxIP + classIPBonus + skillIPBonus + otherIPBonuses
crisisThreshold = floor(maxHP / 2)
currentHP = maxHP                      // on initial creation
currentMP = maxMP
currentIP = maxIP
```

Armor/Defense is **not always additive**. Standard light armor adds offsets to current attribute dice; martial armor may instead set a **fixed physical Defense**. Apply a shield's Defense bonuses afterward. Magical Defense ordinarily starts from current INS plus equipment/skill modifiers. Initiative modifier starts at 0, then applies equipped armor and other applicable effects; negative results are valid.

```text
physicalDefenseBase = equippedArmor.fixedDefense
                      ?? currentDice.DEX + equippedArmor.dexDefenseBonus
physicalDefense = physicalDefenseBase + shield.defenseBonus + skill/effect modifiers
magicDefense = currentDice.INS + equippedArmor.insDefenseBonus
               + shield.magicDefenseBonus + skill/effect modifiers
initiativeModifier = armor.initiativeModifier + otherModifiers
```

The formulas above describe the **standard ordinary equipment path**. Certain skills or rare equipment override components or change evaluation order. Model effects and their stacking/priority explicitly; don't force every effect through a single sum.

### Conditions affecting current dice

The six common statuses are: `weakened` (MIG −1 tier), `dazed` (INS −1), `shaken` (WLP −1), `slow` (DEX −1), `enraged` (DEX and INS −1), `poisoned` (MIG and WLP −1). Multiple **different** conditions affecting the same attribute stack; a duplicate of the **same** condition does not. Current die cannot fall below d6. Additional temporary effects may increase dice up to d12.

**Crucial invariant:** Temporary die changes must **not** recalculate maximum HP/MP. They can affect Defense/Magic Defense where those defenses use current dice. Only base-die advancement, level changes, and actual stat modifiers alter max HP/MP.

## 5. Equipment, proficiencies, slots, money

- Initial purchase budget is 500 ZNT. Only **common weapons, armor and shields** are normally selectable. Rare items or vehicles require the group/GM's approval; custom starting weapons also require approval under the book's exception rules.
- An item marked martial (`E` in the Polish tables) can be **equipped only when the PC has the relevant entitlement**. Distinguish `martialMelee`, `martialRanged`, `martialArmor`, `martialShield`; they are not interchangeable.
- Equipped slots: **one armor**, **main hand**, **off hand**, and **one accessory**. Normally a two-handed weapon occupies both hands. Main hand permits one- or two-handed weapons; off hand permits a one-handed weapon or shield. Specific skills can override restrictions (e.g., a shield in the main hand).
- Items not currently equipped are in the **backpack/inventory** and give no passive equipped effects. Backpack capacity is fiction/GM-dependent, not a fixed weight cap in these rules.
- Do not track individual ammunition for ordinary ranged weapons. Standard one-use potions/remedies are represented abstractly by **IP**, not a stack of conventional potion items by default.
- On creation, `cashZenit = 500 - sum(purchasePrices) + 10 * (die6a + die6b)` with **each die in 1…6**. A user-entered rolled result should be auditable; no need to reroll at load time.
- Starting mundane weapon/armor names and prices appear in printed pp. 166–169, equivalent PDF pp. 168–171. A rule-data catalog is preferable to embedding item names or numbers in application logic.

### Representative starter item data for regression tests

These values are enough to validate the sample character in §11; they do **not** constitute the entire common-item catalog.

```json
{
  "rapier": { "category": "melee_weapon", "martial": true, "hands": 1, "priceZenit": 200, "accuracyDice": ["DEX", "INS"], "accuracyBonus": 1, "damageBonus": 6, "damageType": "physical" },
  "traveler_garb": { "category": "armor", "martial": false, "priceZenit": 100, "dexDefenseBonus": 1, "insDefenseBonus": 1, "initiativeModifier": -1 },
  "runic_shield": { "category": "shield", "martial": true, "priceZenit": 150, "defenseBonus": 2, "magicDefenseBonus": 2, "initiativeModifier": 0 }
}
```

## 6. Skills, spells, and class-specific choices

Each class level purchases one **rank** in one of that class's skills. Rules data must specify:

```text
classId, skillId, maxRank, sourcePage, choicesSchema, derivedModifiers, effects
```

- Skill rank (`PU`) equals the number of times it was chosen; single-purchase skills have `maxRank = 1`.
- Reject selection exceeding the rule-defined maximum rank. The described companion `Fabula_Ultima_Core_Skill_Index.json` is not available in this repository; obtain IDs and maximum ranks from the rulebook before implementing them. Some skills have ranks 2, 3, 4, 5, 6, or 10; **do not assume every skill has the same cap**.
- Five starting class levels imply five total skill-rank purchases spread over the chosen classes. Sum of chosen skill ranks **within each class** equals that class's current level (barring future special rule exceptions, which need explicit handling).
- Skills may require **parameters at purchase time** (learned spell, preferred test dice, gadget category/tier, bound Arcanum, etc.). Store those selections, not just the skill name and rank.
- Class-granted ritual disciplines, learned spells, summon/companion state, project access and passive effects belong to **capabilities**, not to numeric stats alone.
- Skill effects, spell definitions and abilities must be sourced from the class entries, printed pp. 176–215, and applicable later references; the current condensed document does not enumerate every effect.

Examples of special structured payloads to support when appropriate skills are owned: `learnedSpellIds[]`, `spellSource`, `ritualDisciplines[]`, `gadgetUpgrades[]`, `boundArcana[]`, `companionProfileRef`, `activeProjects[]`.

## 7. Narrative traits, Bonds and additional PC state

**Narrative traits:** `identity`, `theme`, `origin`. All three can be invoked with Fabula Points under the rules; treat them as text/structured narrative data, not a fixed combat-stat modifier. Identity and theme may later change during level progression. Origin is generally stable unless fiction warrants a discovery.

**Bonds (Więzi):** Up to **six** active Bonds. Target may be a person, party, nation, organization, belief, etc. (not self). Each Bond has 1–3 emotions, with **at most one** emotion from each mutually exclusive pair:

```text
admiration | inferiority
loyalty    | distrust
affection  | hatred
```

Bond strength is exactly the count of active emotions (1–3). A newly created Bond starts with **one** emotion. Do **not** force six Bonds at character creation; they may develop during play. See printed pp. 56–57.

**Fabula Points:** PC starts with 3; keep current total as a persistent, mutable resource. It is not the same resource as Villain Ultima Points. No universal hard upper bound is established for PC Fabula Points.

**Statuses:** Start empty unless specifically overridden by scenario/effects; keep active status IDs and immunities.

**Damage affinities:** Store an optional per-damage-type effective relation for physical, air, lightning, ice, fire, earth, dark, light and poison. Default relation is **normal**; other possible relations are `vulnerable`, `resistant`, `immune`, `absorbing` (printed p. 92). Derived affinities may depend on temporary effects.

**XP:** Track unspent experience points separately from PC level. A standard new level-5 character has 0 XP unless the campaign says otherwise.

## 8. Advancement rules (so persisted profiles remain coherent)

- Maximum **character level = 50**; each level equals one class level invested.
- At session end, normally gain XP; if at least **10 XP**, spend 10 and advance **one** level. Standard advancement allows at most **one level per session**, even if the XP total is much higher. Keep excess XP.
- One level increase adds **+1 to maximum HP and +1 to maximum MP** through the level portion of the formulas, but **does not automatically heal/refill current HP/MP**.
- Each level advances **one existing class** or unlocks **one new class** and grants one skill rank; new class grants its free benefits once.
- **Class maximum = 10**. At class level 10, the class becomes mastered and grants **one Heroic Skill**, in addition to the ordinary class-skill purchase for that level. Choose only an eligible Heroic Skill, observing any prerequisites and one-time restrictions (printed pp. 232+).
- **At most three classes can be simultaneously unmastered** (`1 <= classLevel < 10`); to acquire more new classes, master an existing one first. Mastered classes no longer count toward the three-class unmastered limit.
- On reaching total **level 20** and again at **level 40**, permanently raise **one** base attribute die by **one tier**, to a maximum of d12. Recompute affected maxima and defenses.
- Identity and/or theme can be changed when gaining a level.
- For higher-level starting PCs, create a valid level-5 PC first, then run normal advancement until the intended level. The book suggests (but does not mandate) a larger initial equipment budget of **500 + 50 × (level − 5) ZNT** (e.g., 2,000 at level 30). Do not confuse this **optional starting-budget recommendation** with advancement cash gains.

Printed source: pp. 226–229.

## 9. Recommended engine data model (design proposal, not rulebook text)

Use a **normalized source-of-truth** document and recalculate derived numbers from it. Avoid persisting only final stats, or stale fields after equipment/status changes.

```ts
type Die = 6 | 8 | 10 | 12;
type Attribute = 'DEX' | 'INS' | 'MIG' | 'WLP';
type EquipmentSlot = 'armor' | 'mainHand' | 'offHand' | 'accessory';
type BondEmotion = 'admiration' | 'inferiority' | 'loyalty' | 'distrust' | 'affection' | 'hatred';

type CharacterProfile = {
  id: string;
  ruleSet: 'fabula_ultima_core';
  ruleSetVersion?: string;
  campaignId?: string;
  partyId?: string;

  identity: { name: string; pronouns?: string; appearance?: string;
              concept: string; theme: string; themeDetails?: string;
              origin: string; originLocationId?: string;
              description?: string; };

  creation: { startingAttributeProfile: 'generalist' | 'balanced' | 'specialist';
              purchaseBudgetZenit: number;
              startingCashRoll?: [number, number];
              exceptionApprovals?: string[]; };

  attributes: { base: Record<Attribute, Die> };
  classes: Array<{ classId: string; level: number;
                   skills: Array<{ skillId: string; rank: number;
                                  choices?: Record<string, unknown> }> }>;

  equipment: { inventory: Array<{ instanceId: string; itemId: string;
                                  customName?: string; acquiredPriceZenit?: number }>;
               equipped: Partial<Record<EquipmentSlot, string>>;
               cashZenit: number; };

  resources: { hp: number; mp: number; ip: number;
               fabula: number; xp: number; };

  bonds: Array<{ targetId?: string; targetName: string;
                 emotions: BondEmotion[] }>;
  activeStatuses: string[];
  ongoingEffects: Array<{ effectId: string; sourceRef?: string;
                         remainingDuration?: string; params?: Record<string, unknown> }>;

  // Class/skill-dependent state; only populated when applicable:
  learnedSpells?: Array<{ spellId: string; sourceSkillId: string }>;
  arcana?: string[];
  companionId?: string;
  projects?: string[];
  gadgets?: Array<{ category: string; tier: string }>;
  heroicSkills?: string[];
};

type DerivedCharacter = {
  level: number;
  currentDice: Record<Attribute, Die>;
  maxHP: number; maxMP: number; maxIP: number; crisisThreshold: number;
  physicalDefense: number; magicalDefense: number; initiativeModifier: number;
  equipmentProficiencies: string[];
  capabilities: string[];
  effectiveDamageAffinities: Record<string, string>;
};
```

### Calculation/validation pipeline

```text
validateSource(profile)
  - check narrative required fields and starting-array permutation
  - verify class IDs exist; correct number of initial classes and levels
  - verify each class's skills belong to that class
  - verify skill ranks, purchases, prerequisites, required choices
  - verify ownership/availability of spells, Arcana, companions, gadgets
  - verify equipment IDs, slots, hand count, martial entitlements
  - verify item purchase total / optional approvals, roll values and currency
  - verify Bond count and one emotion per pair; reject self-Bonds
  - verify hp/mp/ip current values within recomputed maxima

calculate(profile, catalogs):
  level = sum(class levels)
  entitlements = union(benefits for distinct acquired classes)
  modifiers = collect(class benefits, skills, equipment, statuses, active effects)
  currentDice = applyTierEffects(baseDice, modifiers, min=d6, max=d12)
  maxHP = level + 5 * baseDice.MIG + all applicable HP modifiers
  maxMP = level + 5 * baseDice.WLP + all applicable MP modifiers
  maxIP = 6 + all applicable IP modifiers
  crisis = floor(maxHP / 2)
  defenses = resolveBaseAndFixedArmorThenShieldsAndSkills(currentDice, loadout)
  initiative = 0 + armor and applicable initiative modifiers
  return new immutable DerivedCharacter(...)
```

**Avoid double counting:** If you represent each skill's cumulative rank effect as `rank * multiplier`, apply it **once per skill**, not once for every historical purchase record. Classes' free benefits similarly apply once per distinct acquired class. Distinguish additive modifiers, fixed values, replacements, and conditional/temporary effects.

**Keep combat distinct:** Accuracy checks are generally rolls of two current attribute dice specified by the chosen weapon or spell, with fixed bonuses. Do not make attributes into D20 modifiers. For an attack's higher die result (`WW`, Wyższy Wynik), retain the dice independently, not merely their sum (printed p. 68 and weapon tables).

## 10. Acceptance tests for an implementing AI agent

1. New level-5 `balanced` PC may assign DEX=d8, INS=d10, MIG=d6, WLP=d8.
2. Class allocation `orator:2`, `weaponmaster:3` is valid; a single class with level 5 is **invalid at initial creation**.
3. Class benefits grant this PC **+5 max MP** and **+5 max HP**, regardless of the class-level distribution.
4. With no armor or shield: HP=40, MP=50, IP=6, Crisis=20, Defense=8, Magic Defense=10, Initiative modifier=0.
5. With `traveler_garb` and `runic_shield`: physical Defense=11, magical Defense=13, Initiative modifier=−1.
6. After buying rapier (200), traveler garb (100), runic shield (150), leftover creation budget is 50 ZNT. If the initial 2d6 result is 6, cash is 110 ZNT. A `weaponmaster` can legally equip the martial rapier and martial shield.
7. A level-5 rogue/wayfarer/tinkerer combination gets **IP 12** (`6 + 2 + 2 + 2`) because class freebies stack.
8. Applying `slow` to a base DEX=d8 character drops **current** DEX to d6 (affecting die-based physical Defense), without changing max HP/MP.
9. `dazed` plus `enraged` drops INS two tiers, never below d6. Applying `dazed` twice does not stack.
10. A Bond with both `admiration` and `inferiority` is invalid; with `admiration` and `loyalty`, strength is 2.
11. A two-handed weapon plus an off-hand shield is invalid without an explicit overriding ability.
12. On advancement from level 19→20, increase a chosen base die one tier; on leveling from 20→21, do not increase a base die again. Class max stays 10.
13. Mastering a class at level 10 grants one eligible Heroic Skill **in addition to** the level's ordinary class skill.
14. A PC with three unmastered classes cannot acquire a fourth unmastered class.
15. Changes to skills, equipment, classes, or statuses trigger derived-stat recalculation; reloading a saved character is deterministic (no starting-cash reroll).

## 11. Worked example: mechanically consistent level-5 PC

Based on the rulebook's example character Camilla (printed pp. 161–165). This is a **test fixture**, not a mandatory character archetype.

```json
{
  "name": "Camilla",
  "level": 5,
  "classes": [ { "id": "orator", "level": 2 }, { "id": "weaponmaster", "level": 3 } ],
  "baseDice": { "DEX": 8, "INS": 10, "MIG": 6, "WLP": 8 },
  "classBonuses": { "maxHP": 5, "maxMP": 5, "maxIP": 0 },
  "maxHP": 40,
  "maxMP": 50,
  "maxIP": 6,
  "crisis": 20,
  "loadout": [ "rapier", "traveler_garb", "runic_shield" ],
  "physicalDefense": 11,
  "magicalDefense": 13,
  "initiativeModifier": -1,
  "startingCashRollTotal": 6,
  "cashZenit": 110,
  "fabula": 3
}
```

## 12. Agent implementation instructions

When modifying the RPG engine:

1. Treat the **mechanical rule sections (§1–8)** above as requirements grounded in the provided core rulebook. Treat **§9** as a proposed data architecture that can be adapted to the existing codebase.
2. Inspect existing domain models, validation, persistence, rules tables and UI **before** replacing or adding concepts. Reuse existing conventions and preserve migrations.
3. Implement **pure, deterministic** functions for initialization, calculation and validation. Keep random dice rolls injectable/testable.
4. Separate **player selections** from **derived state** and from **catalog rules data**. Persist choices and rolled money, not only a flat computed sheet.
5. Build a **rules-catalog layer** for classes, skills, spells, items, Arcana and heroic skills. Do not pretend the class-bonus table is a complete class definition.
6. Ensure the creation UI enforces level 5, 2–3 classes, five skill-rank picks, legal starting dice arrays, legal purchase totals and item equip restrictions. Support step editing without corrupting derived state.
7. Make recalculation react to changed equipment, statuses, skills and advancement. Respect die floors/caps and effect precedence.
8. Implement the listed acceptance tests and use the Camilla fixture for regression.
9. For details not included in this extract (notably the actual **75 class skill effects**, full spell effects and full item catalog), use the relevant referenced core-rulebook pages or clearly mark functionality as `not_implemented`. **Never fill rule gaps with assumptions borrowed from D&D or generic JRPGs.**
10. If campaign-specific or optional rules differ from the core book, model them as explicit, versioned overrides with traceable GM/group approval.
