/** Deterministic display records, not production random-number generation. */
import type {
  CreateThrowInput,
  SetupDice,
  SideOutcomeJson,
  ThrowRecord,
} from "../../src/modules/game-table/types";
import { makeThrow } from "../domain/fixtures";
import { prototypeStore } from "./store";

function outcome(dice: SetupDice[], modifier: number): SideOutcomeJson {
  const resolved = dice.map((die) => ({ ...die, face: Math.min(6, die.size) }));
  return {
    dice: resolved,
    modifier,
    total: resolved.reduce((sum, die) => sum + die.face, modifier),
    result: "none",
  };
}

export function createPrototypeThrow(input: CreateThrowInput): ThrowRecord {
  const setup = input.setup;
  const character = prototypeStore.characters.find((entry) => entry.id === setup.characterId);
  const npc = prototypeStore.npcs.find((entry) => entry.id === setup.characterId);
  const dice: SetupDice[] =
    setup.type === "attribute"
      ? setup.attributes.map((attribute) => ({
          label: attribute!,
          size: setup.dice[attribute!] ?? 8,
        }))
      : setup.dice.map((size) => ({ label: null, size }));
  const redDice = ("redDice" in setup ? setup.redDice : []).map((size) => ({ label: null, size }));
  const redModifier = "redModifier" in setup ? setup.redModifier : 0;
  const kind =
    setup.type === "weapon"
      ? "weapon-accuracy"
      : setup.type === "free"
        ? "free"
        : redDice.length
          ? "opposed-check"
          : "attribute-check";
  const seq = Math.max(0, ...prototypeStore.throws.map((entry) => entry.seq)) + 1;
  const first = outcome(dice, setup.modifier);
  const second = redDice.length ? outcome(redDice, redModifier) : undefined;
  return {
    ...makeThrow("free"),
    id: `throw-${seq}`,
    seq,
    kind,
    characterId: setup.characterId,
    characterName: (character?.sheet.name as string) ?? npc?.name ?? "GM",
    equipmentId: setup.type === "weapon" ? setup.equipmentId : null,
    setup: {
      type: setup.type,
      kind,
      characterId: setup.characterId,
      equipmentId: setup.type === "weapon" ? setup.equipmentId : null,
      dice,
      modifier: setup.modifier,
      redDice,
      redModifier,
      note: setup.note,
      weaponBonus: null,
      accuracyDice: null,
    },
    outcome: {
      first,
      ...(second
        ? {
            second,
            winner:
              first.total === second.total
                ? "tie"
                : first.total > second.total
                  ? "first"
                  : "second",
          }
        : {}),
    },
  };
}
