import { and, eq, or } from "drizzle-orm";
import { npcAttacks, npcs, throws } from "../../database/schema.ts";
import type { DatabaseTransaction } from "../../database/types.ts";
import type { Attribute, Die, DieSource, RolledDie } from "../fabula/types.ts";
import { checkSide, effectiveDie, genericSide, opposedOutcome, rollDie } from "../fabula/rolls.ts";
import type { GameAccess } from "../games/types.ts";
import { fail } from "./contract.ts";
import type {
  NpcResolvedSetup,
  NpcThrowSetup,
  OutcomeJson,
  ResolvedThrow,
  ThrowKind,
} from "./types.ts";

/** Resolve NPC rolls from authoritative saved stats and immutable source snapshots. */
export async function resolveNpcThrow(
  tx: DatabaseTransaction,
  gameId: string,
  access: GameAccess,
  setup: NpcThrowSetup,
  sourceId: string | null,
  source: DieSource,
  accountId: string,
): Promise<ResolvedThrow> {
  if (access.role !== "GM") throw fail("forbidden");
  const [npc] = await tx
    .select()
    .from(npcs)
    .where(and(eq(npcs.id, setup.npcId), eq(npcs.gameId, gameId)));
  if (!npc) throw fail("not_found");
  if (npc.revision !== setup.expectedRevision) throw fail("stale_revision");
  let previous: NpcResolvedSetup | null = null;
  if (sourceId) {
    const [row] = await tx
      .select({ setup: throws.setup })
      .from(throws)
      .where(
        and(
          eq(throws.id, sourceId),
          eq(throws.gameId, gameId),
          eq(throws.deleted, false),
          or(eq(throws.private, false), eq(throws.authorAccountId, accountId)),
        ),
      );
    if (!row) throw fail("not_found");
    if (row.setup.type !== setup.type || row.setup.npcId !== setup.npcId)
      throw fail("validation", "A reroll keeps the original NPC and roll type", "setup");
    previous = row.setup;
  }
  const baseDice = { DEX: npc.dexDie, INS: npc.insDie, MIG: npc.migDie, WLP: npc.wlpDie } as Record<
    Attribute,
    Die
  >;
  let attributes: [Attribute, Attribute?];
  let dice: RolledDie[];
  let attack: NpcResolvedSetup["attack"] = null;
  if (setup.type === "npc-attack") {
    const [saved] = await tx
      .select()
      .from(npcAttacks)
      .where(and(eq(npcAttacks.id, setup.attackId), eq(npcAttacks.npcId, npc.id)));
    if (!saved) throw fail("not_found");
    if (previous && previous.attack?.id !== setup.attackId)
      throw fail("validation", "A reroll keeps the original attack", "attackId");
    attack = previous?.attack ?? {
      id: saved.id,
      name: saved.name,
      accuracyBonus: Math.floor(npc.level / 10),
      damageBonus: saved.damageBonus,
      damageType: saved.damageType,
    };
    attributes = previous?.attributes ?? [
      saved.attribute1 as Attribute,
      saved.attribute2 as Attribute,
    ];
    dice = [
      rollDie(attributes[0], setup.dice[0], source),
      rollDie(attributes[1]!, setup.dice[1], source),
    ];
  } else {
    attributes = setup.attributes;
    dice = attributes
      .filter((attribute): attribute is Attribute => !!attribute)
      .map((attribute) =>
        rollDie(attribute, effectiveDie(baseDice, attribute, setup.dice[attribute]), source),
      );
  }
  const redDice = setup.type === "npc-attribute" ? setup.redDice : [];
  const redModifier = setup.type === "npc-attribute" ? setup.redModifier : 0;
  const modifier = setup.modifier + (attack?.accuracyBonus ?? 0);
  const red = redDice.map((size, index) =>
    rollDie(
      dice.length === 2 && redDice.length === 2 ? attributes[index]! : `d${size}`,
      size,
      source,
    ),
  );
  const first =
    dice.length === 2
      ? checkSide(dice as [RolledDie, RolledDie], modifier)
      : genericSide(dice, modifier);
  let outcome: OutcomeJson = { first };
  let kind: ThrowKind =
    setup.type === "npc-attack"
      ? "weapon-accuracy"
      : dice.length === 2
        ? "attribute-check"
        : "attribute-roll";
  if (red.length) {
    const check = dice.length === 2 && red.length === 2;
    const second = check
      ? checkSide(red as [RolledDie, RolledDie], redModifier)
      : genericSide(red, redModifier);
    outcome = opposedOutcome(check ? first : genericSide(dice, modifier), second);
    kind = check ? "opposed-check" : "opposed-roll";
  }
  const resolved: NpcResolvedSetup = {
    type: setup.type,
    kind,
    npcId: npc.id,
    npcName: npc.name,
    attributes,
    dice: dice.map(({ label, size }) => ({ label, size })),
    modifier: setup.modifier,
    redDice: red.map(({ label, size }) => ({ label, size })),
    redModifier,
    note: setup.note,
    attack,
  };
  return {
    kind,
    role: "GM",
    characterId: null,
    characterName: npc.name,
    equipmentId: null,
    equipmentName: attack?.name ?? null,
    setup: resolved,
    outcome,
  };
}
