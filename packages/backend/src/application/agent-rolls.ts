import type {
  AgentToolContext,
  AgentToolFactory,
  AgentToolResult,
} from "../modules/agent/types.ts";
import { parseCreateRequest } from "../modules/throws/contract.ts";
import type { ThrowRecord } from "../modules/throws/types.ts";

const string = { type: "string", maxLength: 160 };
const question = (reason: string) => ({ label: "Checked roll setup", data: { reason } });
function matches<T extends { id: string; name: string }>(rows: T[], text: unknown) {
  const query = typeof text === "string" ? text.trim().toLowerCase() : "";
  if (!query) return [];
  const exact = rows.filter((row) => row.id === query || row.name.toLowerCase() === query);
  return exact.length ? exact : rows.filter((row) => row.name.toLowerCase().includes(query));
}
// A model can select a specific equipment ID after reading the sheet even when
// the GM named only a family such as "hammer". Resolve that ambiguity in the GM's words.
function weaponMatches(rows: { id: string; name: string }[], query: unknown, message: string) {
  const gmWords = new Set(message.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const selected = matches(rows, query);
  if (selected.length !== 1) return selected;
  const name = selected[0]!.name.toLowerCase();
  if (message.toLowerCase().includes(name)) return selected;
  for (const word of name.split(/\s+/)) {
    if (!gmWords.has(word)) continue;
    const alternatives = rows.filter((row) => row.name.toLowerCase().split(/\s+/).includes(word));
    if (alternatives.length > 1) return alternatives;
  }
  return selected;
}
function proposal(
  setup: unknown,
  privateRoll: boolean,
  sourceThrowId: string | null,
  targetLabel?: string,
  detail?: unknown,
): AgentToolResult {
  try {
    const input = parseCreateRequest({ setup, private: privateRoll, sourceThrowId });
    return {
      label: "Prepared roll for review",
      data: { prepared: true, setup: input.setup, private: privateRoll, detail },
      action: { kind: "roll", input, ...(targetLabel ? { targetLabel } : {}) },
    };
  } catch (error) {
    if ((error as { code?: string }).code !== "validation") throw error;
    return question((error as Error).message);
  }
}
function reroll(ctx: AgentToolContext, source: ThrowRecord) {
  const s = source.setup;
  const common = { modifier: s.modifier, note: s.note };
  const opponent = { redDice: s.redDice.map((d) => d.size), redModifier: s.redModifier };
  const dice = s.dice.map((d) => d.size);
  if (s.type === "free")
    return proposal(
      { type: "free", characterId: s.npcId ?? s.characterId ?? "gm", ...common, ...opponent, dice },
      source.private,
      source.id,
    );
  const npc =
    "npcId" in s && s.npcId
      ? ctx.table.npcs.find((row) => row.id === s.npcId && row.view === "gm")
      : undefined;
  const actor =
    npc?.view === "gm"
      ? npc
      : ctx.table.party.find((row) => "characterId" in s && row.id === s.characterId);
  if (!actor) return question("The original actor is unavailable.");
  const base = {
    ...common,
    type: s.type,
    expectedRevision: actor.revision,
    ...(npc ? { npcId: actor.id } : { characterId: actor.id }),
  };
  if (s.type === "weapon" || s.type === "npc-attack")
    return proposal(
      {
        ...base,
        ...(s.type === "weapon"
          ? { equipmentId: s.equipmentId }
          : { attackId: "attack" in s ? s.attack?.id : undefined }),
        dice,
      },
      source.private,
      source.id,
    );
  return proposal(
    {
      ...base,
      ...opponent,
      attributes: s.dice.map((d) => d.label),
      dice: Object.fromEntries(s.dice.map((d) => [d.label, d.size])),
    },
    source.private,
    source.id,
  );
}
export const createRollTools: AgentToolFactory = (ctx) => [
  {
    name: "prepare_throw",
    description:
      "Prepare a roll for GM review. Pass actor, target and weapon names as worded by GM. For character attacks with no specified weapon omit weapon. For an explicit unarmed strike use weapon='Unarmed'. For an agility check send kind='attribute', attributes=['DEX','DEX']; omit dice. Free roll dice are integer sizes. For reroll pass sourceThrowId from read_throws. Never include target in note.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { enum: ["free", "weapon", "attribute", "reroll"] },
        actor: string,
        target: string,
        weapon: string,
        sourceThrowId: string,
        private: { type: "boolean" },
        note: { ...string, description: "Use only the GM’s verbatim activity, e.g. Tumbling." },
        modifier: { type: "integer" },
        dice: {
          type: "array",
          description: "For free rolls only. Numeric die sizes.",
          items: { type: "integer" },
          maxItems: 12,
        },
        attributes: { type: "array", items: { enum: ["DEX", "INS", "MIG", "WLP"] }, maxItems: 2 },
      },
    },
    async execute(args) {
      if (args.kind === "reroll") {
        const source = (await ctx.visibleThrows()).find((row) => row.id === args.sourceThrowId);
        return source ? reroll(ctx, source) : question("The source throw is unavailable.");
      }
      const actors = [...ctx.table.party, ...ctx.table.npcs.filter((n) => n.view === "gm")];
      const targets = matches(actors, args.target);
      if (args.target && targets.length !== 1) return question("Clarify the target.");
      const selected = matches(actors, args.actor);
      const actor = selected.length === 1 ? selected[0] : undefined;
      const privateRoll =
        args.private === true ||
        (actor && "visibility" in actor && actor.visibility === "hidden") ||
        false;
      const modifier = args.modifier ?? 0;
      const activity =
        args.kind === "attribute"
          ? ctx.message.match(/\bwhen\s+([^.!?]+)[.!?]?$/i)?.[1]?.trim()
          : undefined;
      const noteText = activity
        ? activity[0]!.toUpperCase() + activity.slice(1)
        : typeof args.note === "string"
          ? args.note.trim()
          : "";
      const hiddenTerms = ctx.table.npcs
        .flatMap((n) =>
          n.view === "gm" ? [n.id, n.notes, ...(n.visibility === "hidden" ? [n.name] : [])] : [],
        )
        .filter(Boolean);
      const note =
        ctx.message.toLowerCase().includes(noteText.toLowerCase()) &&
        !hiddenTerms.some((term) => noteText.toLowerCase().includes(term.toLowerCase()))
          ? noteText
          : "";
      const opponent = { redDice: [], redModifier: 0 };
      if (args.kind === "free") {
        if (args.actor && args.actor !== "gm" && !actor) return question("Clarify the actor.");
        return proposal(
          {
            type: "free",
            characterId: actor?.id ?? "gm",
            dice: args.dice,
            modifier,
            note,
            ...opponent,
          },
          privateRoll,
          null,
        );
      }
      if (!actor) return question("Clarify the actor.");
      const npc = "view" in actor;
      const base = {
        ...(npc ? { npcId: actor.id } : { characterId: actor.id }),
        expectedRevision: actor.revision,
        modifier,
      };
      const current = npc ? actor.baseDice : actor.currentDice;
      if (args.kind === "attribute") {
        const attributes = args.attributes as (keyof typeof current)[] | undefined;
        if (!attributes?.length) return question("Which attribute should be checked?");
        const pair = attributes.length === 1 ? [attributes[0], attributes[0]] : attributes;
        return proposal(
          {
            ...base,
            type: npc ? "npc-attribute" : "attribute",
            attributes: pair,
            dice: Object.fromEntries(pair.map((a) => [a, current[a]])),
            note,
            ...opponent,
          },
          privateRoll,
          null,
          targets[0]?.name,
        );
      }
      const available = npc ? actor.attacks : actor.weapons;
      const weaponName = typeof args.weapon === "string" ? args.weapon.trim() : "";
      const unarmed =
        /^(unarmed(?: strike| attack)?|bare hands?|fists?|without (?:a )?weapon)$/i.test(
          weaponName,
        );
      if (!npc && (unarmed || (!weaponName && !available.length))) {
        return proposal(
          {
            ...base,
            type: "attribute",
            attributes: ["DEX", "MIG"],
            dice: { DEX: current.DEX, MIG: current.MIG },
            note: "Unarmed strike",
            ...opponent,
          },
          privateRoll,
          null,
          targets[0]?.name,
        );
      }
      if (!available.length)
        return question(
          npc
            ? actor.name +
                " has no attacks on their NPC profile. Add an attack before preparing this roll."
            : actor.name +
                " has no weapon on their sheet. Use an unarmed strike, or add the requested weapon in Equipment.",
        );
      const weapons = weaponMatches(available, args.weapon, ctx.message);
      if (weapons.length !== 1)
        return question(
          weapons.length
            ? "Which weapon: " + weapons.map((w) => w.name).join(", ") + "?"
            : "Which weapon is being used?",
        );
      const id = weapons[0]!.id;
      const weapon = npc
        ? actor.attacks.find((w) => w.id === id)!
        : actor.weapons.find((w) => w.id === id)!;
      if ("ready" in weapon && !weapon.ready)
        return question("Complete the weapon's accuracy dice and bonus in its equipment setup.");
      const attrs = "attributes" in weapon ? weapon.attributes : weapon.accuracyDice;
      const dice = attrs.map((a) => current[a as keyof typeof current]);
      return proposal(
        {
          ...base,
          type: npc ? "npc-attack" : "weapon",
          ...(npc ? { attackId: id } : { equipmentId: id }),
          dice,
          note: "",
        },
        privateRoll,
        null,
        targets[0]?.name,
        {
          actor: actor.name,
          weapon: weapon.name,
          target: targets[0]?.name,
          attributes: attrs,
          accuracyBonus:
            "accuracyBonus" in weapon
              ? weapon.accuracyBonus
              : npc
                ? Math.floor(actor.level / 10)
                : 0,
          dice,
        },
      );
    },
  },
];
