import { tr } from "../../shared/i18n";
import type { PartyCharacter } from "../game-table/types";
import type { AgentAction } from "./types";
export function rollPreview(
  action: Extract<AgentAction, { kind: "roll" }>,
  actors: PartyCharacter[],
) {
  const setup = action.input.setup;
  const id = "npcId" in setup ? setup.npcId : setup.characterId;
  const actor = actors.find((person) => person.id === id);
  const weaponId =
    "attackId" in setup ? setup.attackId : "equipmentId" in setup ? setup.equipmentId : undefined;
  const weapon = actor?.weapons.find((item) => item.id === weaponId);
  const dice =
    "attributes" in setup
      ? setup.attributes.flatMap((attr) => (attr ? [attr + " d" + setup.dice[attr]] : []))
      : setup.dice.map((size, i) =>
          [weapon?.accuracyDice[i], "d" + size].filter(Boolean).join(" "),
        );
  const modifier = setup.modifier + (weapon?.accuracyBonus ?? 0);
  const formula =
    dice.join(" + ") + (modifier ? " " + (modifier > 0 ? "+" : "−") + Math.abs(modifier) : "");
  const opponent =
    "redDice" in setup && setup.redDice.length
      ? " " +
        tr("ui.vs") +
        " " +
        setup.redDice.map((d) => "d" + d).join(" + ") +
        (setup.redModifier
          ? " " + (setup.redModifier > 0 ? "+" : "−") + Math.abs(setup.redModifier)
          : "")
      : "";
  return {
    name: [actor?.name ?? (id === "gm" ? tr("ui.gm") : tr("ui.roll")), weapon?.name, setup.note]
      .filter(Boolean)
      .join(" · "),
    formula: formula + opponent,
    sizes: [
      ...("attributes" in setup
        ? setup.attributes.flatMap((attr) => (attr && setup.dice[attr] ? [setup.dice[attr]] : []))
        : setup.dice),
      ...("redDice" in setup ? setup.redDice : []),
    ],
  };
}
