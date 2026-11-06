// Pure throw resolution: turns a validated setup plus current game facts into a
// persisted snapshot (resolved setup + structured outcome). Dice come from the
// injected die source so tests can script faces. All permission decisions are made
// here from resolved context, never from request fields alone.
import type { Attribute, Die, EquipmentEntry, FabulaSheet } from "../fabula/rules.ts";
import {
  checkSide,
  effectiveDie,
  genericSide,
  opposedOutcome,
  rollDie,
  standardDice,
  type DieSource,
  type RolledDie,
} from "../fabula/rolls.ts";
import { fail, gmActorId, type CreateThrowInput, type OutcomeJson, type ResolvedSetup, type ThrowKind, type ThrowSetup } from "./contract.ts";

export type RollCharacter = {
  id: string;
  playerId: string | null;
  revision: number;
  name: string;
  sheet: FabulaSheet;
};

export type SourceThrow = {
  kind: ThrowKind;
  setup: ResolvedSetup;
  characterId: string | null;
  equipmentId: string | null;
};

export type ResolutionContext = {
  role: "GM" | "Player";
  membershipId: string | null;
  activeCharacterIds: readonly string[];
  ownActiveCharacterId: string | null;
  character: RollCharacter | null;
  weapon: Extract<EquipmentEntry, { kind: "weapon" }> | null;
  source: SourceThrow | null;
};

export type ResolvedThrow = {
  kind: ThrowKind;
  role: "GM" | "Player";
  characterId: string | null;
  characterName: string;
  equipmentId: string | null;
  equipmentName: string | null;
  setup: ResolvedSetup;
  outcome: OutcomeJson;
};

type BaseSetup = Omit<ResolvedSetup, "kind">;

function requireRollableCharacter(context: ResolutionContext, characterId: string) {
  const character = context.character;
  if (!character || character.id !== characterId) throw fail("not_found");
  if (!context.activeCharacterIds.includes(characterId)) throw fail("inactive_character", "That character is no longer active");
  if (context.role === "Player" && character.playerId !== context.membershipId)
    throw fail("forbidden", "You can only roll as your own active character");
  return character;
}

function finish(
  context: ResolutionContext,
  base: BaseSetup,
  kind: ThrowKind,
  character: RollCharacter | null,
  equipment: { id: string; name: string } | null,
  outcome: OutcomeJson,
): ResolvedThrow {
  return {
    kind,
    role: context.role,
    characterId: base.characterId,
    characterName: character?.name ?? "GM",
    equipmentId: equipment?.id ?? null,
    equipmentName: equipment?.name ?? null,
    setup: { ...base, kind },
    outcome,
  };
}

function resolveAttribute(input: CreateThrowInput, context: ResolutionContext, source: DieSource): ResolvedThrow {
  const setup = input.setup as Extract<ThrowSetup, { type: "attribute" }>;
  if (context.source && setup.characterId !== context.source.characterId)
    throw fail("validation", "A reroll keeps the original character", "characterId");
  const character = requireRollableCharacter(context, setup.characterId);
  if (setup.expectedRevision !== character.revision) throw fail("stale_revision", "The sheet changed since this roll was prepared");
  const [first, second] = setup.attributes;
  const firstSize = effectiveDie(character.sheet.baseDice, first, setup.dice[first]);
  const secondSize = second ? effectiveDie(character.sheet.baseDice, second, setup.dice[second]) : undefined;
  const friendly: RolledDie[] = [rollDie(first, firstSize, source)];
  if (second && secondSize) friendly.push(rollDie(second, secondSize, source));
  const base: BaseSetup = {
    type: "attribute",
    characterId: character.id,
    equipmentId: null,
    dice: friendly.map((die) => ({ label: die.label, size: die.size })),
    modifier: setup.modifier,
    redDice: [],
    redModifier: setup.redModifier,
    note: setup.note,
    weaponBonus: null,
    accuracyDice: null,
  };
  if (setup.redDice.length === 2 && second && secondSize) {
    const opponent: RolledDie[] = [rollDie(first, setup.redDice[0]!, source), rollDie(second, setup.redDice[1]!, source)];
    const outcome = opposedOutcome(checkSide(friendly as [RolledDie, RolledDie], setup.modifier), checkSide(opponent as [RolledDie, RolledDie], setup.redModifier));
    return finish(context, { ...base, redDice: opponent.map((die) => ({ label: die.label, size: die.size })) }, "opposed-check", character, null, {
      first: outcome.first,
      second: outcome.second,
      winner: outcome.winner,
    });
  }
  if (setup.redDice.length > 0) {
    const opponent = setup.redDice.map((size) => rollDie(`d${size}`, size, source));
    const outcome = opposedOutcome(genericSide(friendly, setup.modifier), genericSide(opponent, setup.redModifier));
    return finish(context, { ...base, redDice: opponent.map((die) => ({ label: die.label, size: die.size })) }, "opposed-roll", character, null, {
      first: outcome.first,
      second: outcome.second,
      winner: outcome.winner,
    });
  }
  if (friendly.length === 2)
    return finish(context, base, "attribute-check", character, null, { first: checkSide(friendly as [RolledDie, RolledDie], setup.modifier) });
  return finish(context, base, "attribute-roll", character, null, { first: genericSide(friendly, setup.modifier) });
}

function resolveWeapon(input: CreateThrowInput, context: ResolutionContext, source: DieSource): ResolvedThrow {
  const setup = input.setup as Extract<ThrowSetup, { type: "weapon" }>;
  if (context.source && (setup.characterId !== context.source.characterId || setup.equipmentId !== context.source.equipmentId))
    throw fail("validation", "A reroll keeps the original character and weapon", "equipmentId");
  const character = requireRollableCharacter(context, setup.characterId);
  if (setup.expectedRevision !== character.revision) throw fail("stale_revision", "The sheet changed since this roll was prepared");
  if (!context.weapon) throw fail("not_found");
  const reroll = context.source?.kind === "weapon-accuracy" ? context.source.setup : null;
  const accuracyDice = reroll?.accuracyDice ?? context.weapon.accuracyDice;
  const weaponBonus = reroll?.weaponBonus ?? context.weapon.accuracyBonus;
  if (!accuracyDice[0] || !accuracyDice[1] || weaponBonus === null)
    throw fail("weapon_incomplete", "Set both accuracy attributes and the accuracy bonus on the character sheet");
  const accuracyPair: [Attribute, Attribute] = [accuracyDice[0], accuracyDice[1]];
  const firstSize = setup.dice[0] ?? effectiveDie(character.sheet.baseDice, accuracyPair[0], undefined);
  const secondSize = setup.dice[1] ?? effectiveDie(character.sheet.baseDice, accuracyPair[1], undefined);
  if (!standardDice.includes(firstSize as Die) || !standardDice.includes(secondSize as Die))
    throw fail("validation", "Weapon dice use d6, d8, d10 or d12", "dice");
  const friendly = [rollDie(accuracyPair[0], firstSize, source), rollDie(accuracyPair[1], secondSize, source)];
  const base: BaseSetup = {
    type: "weapon",
    characterId: character.id,
    equipmentId: context.weapon.id,
    dice: friendly.map((die) => ({ label: die.label, size: die.size })),
    modifier: setup.modifier,
    redDice: [],
    redModifier: 0,
    note: setup.note,
    weaponBonus,
    accuracyDice: accuracyPair,
  };
  return finish(context, base, "weapon-accuracy", character, context.weapon, {
    first: checkSide(friendly as [RolledDie, RolledDie], setup.modifier + weaponBonus),
  });
}

function resolveFree(input: CreateThrowInput, context: ResolutionContext, source: DieSource): ResolvedThrow {
  const setup = input.setup as Extract<ThrowSetup, { type: "free" }>;
  let character: RollCharacter | null = null;
  if (setup.characterId === gmActorId) {
    if (context.role !== "GM") throw fail("forbidden", "Only the GM can roll as the GM");
  } else {
    if (context.role === "Player" && context.ownActiveCharacterId !== setup.characterId)
      throw fail("no_active_character", "Select an active character before rolling");
    character = requireRollableCharacter(context, setup.characterId);
  }
  const friendly = setup.dice.map((size) => rollDie(null, size, source));
  const base: BaseSetup = {
    type: "free",
    characterId: character?.id ?? null,
    equipmentId: null,
    dice: friendly.map((die) => ({ label: die.label, size: die.size })),
    modifier: setup.modifier,
    redDice: [],
    redModifier: setup.redModifier,
    note: setup.note,
    weaponBonus: null,
    accuracyDice: null,
  };
  if (setup.redDice.length === 2 && friendly.length === 2 && [...setup.dice, ...setup.redDice].every((size) => standardDice.includes(size as Die))) {
    const opponent = setup.redDice.map((size) => rollDie(null, size, source));
    const outcome = opposedOutcome(
      checkSide(friendly as [RolledDie, RolledDie], setup.modifier),
      checkSide(opponent as [RolledDie, RolledDie], setup.redModifier),
    );
    return finish(context, { ...base, redDice: opponent.map((die) => ({ label: die.label, size: die.size })) }, "opposed-check", character, null, {
      first: outcome.first,
      second: outcome.second,
      winner: outcome.winner,
    });
  }
  if (setup.redDice.length > 0) {
    const opponent = setup.redDice.map((size) => rollDie(null, size, source));
    const outcome = opposedOutcome(genericSide(friendly, setup.modifier), genericSide(opponent, setup.redModifier));
    return finish(context, { ...base, redDice: opponent.map((die) => ({ label: die.label, size: die.size })) }, "opposed-roll", character, null, {
      first: outcome.first,
      second: outcome.second,
      winner: outcome.winner,
    });
  }
  return finish(context, base, "free", character, null, { first: genericSide(friendly, setup.modifier) });
}

/** Resolves a validated create input against current game facts and rolls the dice. */
export function resolveThrow(input: CreateThrowInput, context: ResolutionContext, source: DieSource): ResolvedThrow {
  if (context.source && context.source.setup.type !== input.setup.type)
    throw fail("validation", "The reroll setup does not match the original throw", "setup.type");
  if (input.setup.type === "attribute") return resolveAttribute(input, context, source);
  if (input.setup.type === "weapon") return resolveWeapon(input, context, source);
  return resolveFree(input, context, source);
}
