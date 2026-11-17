import type { AgentAction, AgentToolFactory } from "../modules/agent/types.ts";
import type { ObjectInputSchema } from "../shared/validation/types.ts";

const integer = { type: "integer", minimum: 0, maximum: 2147483647 };
const name = { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" };
const die = { type: "integer", enum: [6, 8, 10, 12] };
function fields(properties: Record<string, object>): ObjectInputSchema {
  return { type: "object", properties, minProperties: 1, additionalProperties: false };
}
const baseDice = fields({ DEX: die, INS: die, MIG: die, WLP: die });
const resource = fields({ current: integer, max: integer });
function parameters(properties: Record<string, object>): ObjectInputSchema {
  return {
    ...fields({ id: { type: "string", minLength: 1, maxLength: 64 }, changes: fields(properties) }),
    required: ["id", "changes"],
  };
}
const missing = {
  data: { reason: "Ask the GM to identify a current table record." },
  label: "Checked edit target",
};
type CharacterEdit = Extract<AgentAction, { kind: "edit_character" }>;
type NpcEdit = Extract<AgentAction, { kind: "edit_npc" }>;

export const createEditTools: AgentToolFactory = (ctx) => [
  {
    name: "prepare_character_edit",
    description:
      "Prepare requested changes to one active character by table id for GM review. Include only the fields requested.",
    parameters: parameters({
      name,
      theme: { anyOf: [{ type: "string", maxLength: 200 }, { type: "null" }] },
      level: { type: "integer", minimum: 5, maximum: 50 },
      baseDice,
      resources: fields({ hp: integer, mp: integer, ip: integer, fabula: integer }),
    }),
    async execute(args) {
      const person = ctx.table.party.find((member) => member.id === args.id);
      if (!person) return missing;
      const record = await ctx.characters.getWorkspaceCharacter(ctx.actor, ctx.gameId, person.id);
      const changes = args.changes as CharacterEdit["changes"];
      if (changes.name) changes.name = changes.name.trim();
      return {
        action: {
          kind: "edit_character",
          characterId: person.id,
          expectedRevision: record.revision,
          changes,
        },
        data: { prepared: true, name: person.name, changes },
        label: "Prepared character edit",
      };
    },
  },
  {
    name: "prepare_npc_edit",
    description:
      "Prepare requested profile changes to one NPC by table id for GM review. For relative HP changes use changes.hpDelta (e.g. -5 to reduce by 5), never hp.current. For absolute HP use changes.hp.current.",
    parameters: parameters({
      name,
      relationship: { enum: ["enemy", "neutral", "friend"] },
      level: { type: "integer", minimum: 5, maximum: 60 },
      baseDice,
      hp: resource,
      hpDelta: { type: "integer", minimum: -2147483647, maximum: 2147483647 },
      mp: resource,
      defense: integer,
      magicDefense: integer,
      notes: { type: "string", maxLength: 2000 },
    }),
    async execute(args) {
      if (!ctx.table.npcs.some((npc) => npc.id === args.id)) return missing;
      const [npc] = await ctx.npcs.read(ctx.actor, ctx.gameId, String(args.id));
      if (npc?.view !== "gm") return missing;
      const { hpDelta, ...changes } = args.changes as NpcEdit["changes"] & { hpDelta?: number };
      if (hpDelta !== undefined) {
        if (changes.hp)
          return {
            data: { reason: "Clarify whether HP is an adjustment or an absolute value." },
            label: "Checked NPC resources",
          };
        changes.hp = {
          ...npc.hp,
          current: Math.max(0, Math.min(npc.hp.max, npc.hp.current + hpDelta)),
        };
      }
      if (changes.name) changes.name = changes.name.trim();
      if (changes.baseDice) changes.baseDice = { ...npc.baseDice, ...changes.baseDice };
      for (const key of ["hp", "mp"] as const) {
        if (!changes[key]) continue;
        const merged = { ...npc[key], ...changes[key] };
        if (merged.current > merged.max)
          return {
            data: { reason: "The current resource exceeds its maximum. Ask the GM to clarify." },
            label: "Checked NPC resources",
          };
        changes[key] = merged;
      }
      return {
        action: { kind: "edit_npc", npcId: npc.id, expectedRevision: npc.revision, changes },
        data: { prepared: true, name: npc.name, changes },
        label: "Prepared NPC edit",
      };
    },
  },
];
