import type {
  AgentToolContext,
  AgentToolFactory,
  AgentToolResult,
} from "../modules/agent/types.ts";

import type { CreateThrowInput, ThrowRecord } from "../modules/throws/types.ts";

type RollContext = AgentToolContext & { parseThrow(body: unknown): CreateThrowInput };
type RollActor =
  | AgentToolContext["table"]["party"][number]
  | Extract<AgentToolContext["table"]["npcs"][number], { view: "gm" }>;

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
  ctx: RollContext,
  setup: unknown,
  privateRoll: boolean,
  sourceThrowId: string | null,
  targetLabel?: string,
  detail?: unknown,
): AgentToolResult {
  try {
    const input = ctx.parseThrow({ setup, private: privateRoll, sourceThrowId });
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
function reroll(ctx: RollContext, source: ThrowRecord) {
  const s = source.setup;
  const common = { modifier: s.modifier, note: s.note };
  const opponent = { redDice: s.redDice.map((d) => d.size), redModifier: s.redModifier };
  const dice = s.dice.map((d) => d.size);
  if (s.type === "free")
    return proposal(
      ctx,
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
      ctx,
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
    ctx,
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
function resolveRollActors(ctx: RollContext, args: Record<string, unknown>) {
  const actors = [
    ...ctx.table.party,
    ...ctx.table.npcs.filter((n): n is Extract<RollActor, { view: "gm" }> => n.view === "gm"),
  ];
  const targets = matches(actors, args.target);

  const selected = matches(actors, args.actor);
  const actor = selected.length === 1 ? selected[0] : undefined;
  return { actor, targets };
}
function rollNote(ctx: RollContext, args: Record<string, unknown>) {
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
  const normalized = noteText.toLowerCase();
  const suppliedByGm = ctx.message.toLowerCase().includes(normalized);
  const containsHiddenText = hiddenTerms.some((term) => normalized.includes(term.toLowerCase()));
  return suppliedByGm && !containsHiddenText ? noteText : "";
}
const noOpponent = { redDice: [], redModifier: 0 };
function actorSetup(actor: RollActor, modifier: unknown) {
  return {
    ...("view" in actor ? { npcId: actor.id } : { characterId: actor.id }),
    expectedRevision: actor.revision,
    modifier: modifier ?? 0,
  };
}
function prepareAttribute(
  ctx: RollContext,
  args: Record<string, unknown>,
  actor: RollActor,
  privateRoll: boolean,
  targetLabel?: string,
) {
  const npc = "view" in actor;
  const current = npc ? actor.baseDice : actor.currentDice;
  const base = actorSetup(actor, args.modifier);
  const note = rollNote(ctx, args);
  const attributes = args.attributes as (keyof typeof current)[] | undefined;
  if (!attributes?.length) return question("Which attribute should be checked?");
  const pair = attributes.length === 1 ? [attributes[0], attributes[0]] : attributes;
  return proposal(
    ctx,
    {
      ...base,
      type: npc ? "npc-attribute" : "attribute",
      attributes: pair,
      dice: Object.fromEntries(pair.map((a) => [a, current[a]])),
      note,
      ...noOpponent,
    },
    privateRoll,
    null,
    targetLabel,
  );
}
function prepareWeapon(
  ctx: RollContext,
  args: Record<string, unknown>,
  actor: RollActor,
  privateRoll: boolean,
  targetLabel?: string,
) {
  const npc = "view" in actor;
  const current = npc ? actor.baseDice : actor.currentDice;
  const base = actorSetup(actor, args.modifier);
  const available = npc ? actor.attacks : actor.weapons;
  const weaponName = typeof args.weapon === "string" ? args.weapon.trim() : "";
  const unarmed = /^(unarmed(?: strike| attack)?|bare hands?|fists?|without (?:a )?weapon)$/i.test(
    weaponName,
  );
  if (!npc && (unarmed || (!weaponName && !available.length))) {
    return proposal(
      ctx,
      {
        ...base,
        type: "attribute",
        attributes: ["DEX", "MIG"],
        dice: { DEX: current.DEX, MIG: current.MIG },
        note: "Unarmed strike",
        ...noOpponent,
      },
      privateRoll,
      null,
      targetLabel,
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
    ctx,
    {
      ...base,
      type: npc ? "npc-attack" : "weapon",
      ...(npc ? { attackId: id } : { equipmentId: id }),
      dice,
      note: "",
    },
    privateRoll,
    null,
    targetLabel,
    {
      actor: actor.name,
      weapon: weapon.name,
      target: targetLabel,
      attributes: attrs,
      accuracyBonus:
        "accuracyBonus" in weapon ? weapon.accuracyBonus : npc ? Math.floor(actor.level / 10) : 0,
      dice,
    },
  );
}
async function prepareThrow(ctx: RollContext, args: Record<string, unknown>) {
  if (args.kind === "reroll") {
    const source = (await ctx.visibleThrows()).find((row) => row.id === args.sourceThrowId);
    return source ? reroll(ctx, source) : question("The source throw is unavailable.");
  }
  const { actor, targets } = resolveRollActors(ctx, args);
  if (args.target && targets.length !== 1) return question("Clarify the target.");
  const privateRoll =
    args.private === true ||
    (actor && "visibility" in actor && actor.visibility === "hidden") ||
    false;
  const modifier = args.modifier ?? 0;

  if (args.kind === "free") {
    if (args.actor && args.actor !== "gm" && !actor) return question("Clarify the actor.");
    return proposal(
      ctx,
      {
        type: "free",
        characterId: actor?.id ?? "gm",
        dice: args.dice,
        modifier,
        note: rollNote(ctx, args),
        ...noOpponent,
      },
      privateRoll,
      null,
    );
  }
  if (!actor) return question("Clarify the actor.");
  if (args.kind === "attribute")
    return prepareAttribute(ctx, args, actor, privateRoll, targets[0]?.name);
  return prepareWeapon(ctx, args, actor, privateRoll, targets[0]?.name);
}
export function createRollTools(parseThrow: RollContext["parseThrow"]): AgentToolFactory {
  return (ctx) => [
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
      execute: (args) => prepareThrow({ ...ctx, parseThrow }, args),
    },
  ];
}
