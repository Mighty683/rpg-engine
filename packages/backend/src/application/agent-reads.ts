import type { AgentTool, AgentToolContext } from "../modules/agent/types.ts";
import { agentFailure } from "../modules/agent/errors.ts";
import { parseNoteReadInput, parseNoteSearchInput } from "../modules/game-notes/retrieval.ts";
import { uuidSchema } from "../shared/validation/schema.ts";

const id = { type: "string", maxLength: 64, minLength: 1 };
function target<T extends { id: string; name: string }>(rows: T[], query: unknown) {
  const exact = rows.find((row) => row.id === query);
  if (exact || typeof query !== "string") return exact;
  const name = query.trim().toLowerCase();
  const named = rows.filter((row) => row.name.toLowerCase() === name);
  return named.length === 1 ? named[0] : undefined;
}
const missing = { data: { found: false }, label: "Looked up a table record" };

export function createAgentReads(ctx: AgentToolContext): AgentTool[] {
  return [
    {
      name: "read_character",
      description:
        "Read an active character. Supply their exact table name or id in the id field. Use sections to request only skills, equipment or sheet statistics needed to answer.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["id", "sections"],
        properties: {
          id,
          sections: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: { enum: ["skills", "equipment", "stats"] },
          },
        },
      },
      async execute(args) {
        const person = target(ctx.table.party, args.id);
        if (!person) return missing;
        const sections = args.sections as string[];
        const result: Record<string, unknown> = { name: person.name, id: person.id };
        const record = await ctx.characters.getWorkspaceCharacter(ctx.actor, ctx.gameId, person.id);
        if (sections.includes("stats"))
          Object.assign(result, {
            level: record.level,
            theme: record.sheet.theme,
            currentDice: person.currentDice,
            baseDice: record.sheet.baseDice,
            resources: record.sheet.resources,
            defense: person.defense,
            magicDefense: person.magicDefense,
          });
        if (sections.includes("equipment")) result.equipment = record.sheet.equipment.slice(0, 20);
        if (sections.includes("skills"))
          Object.assign(result, {
            manualSkills: record.sheet.skills.slice(0, 20),
            modifierRule:
              "Managed passive modifiers are included in currentDice and derived statistics. Check conditional text separately.",
            learnedSkills: (
              await ctx.characters.learnedSkills(ctx.actor, ctx.gameId, person.id)
            ).slice(0, 20),
          });
        return { data: result, label: "Read " + person.name + "’s sheet" };
      },
    },
    {
      name: "read_npc",
      description:
        "Read an NPC profile. Supply its exact table name or id in the id field. Set includeNotes only for questions requiring the GM notes.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id, includeNotes: { type: "boolean" } },
      },
      async execute(args) {
        const person = target(ctx.table.npcs, args.id);
        if (!person) return missing;
        const [npc] = await ctx.npcs.read(ctx.actor, ctx.gameId, person.id);
        if (npc?.view !== "gm") return missing;
        const { notes, createdAt: _created, updatedAt: _updated, ...data } = npc;
        return {
          data: {
            ...data,
            attacks: data.attacks.slice(0, 20),
            ...(args.includeNotes ? { notes } : {}),
          },
          label: "Read " + npc.name + "’s profile",
        };
      },
    },
    {
      name: "search_notes",
      description:
        "Search the GM's saved notes for the current game with a natural-language query. Returns matching entries (entryId, title, text excerpt, source literal or semantic), at most one match per entry, literal matches first. Read relevant matches with get_notes using the returned entryIds; never cite unrelated entries. If there are no relevant matches and semanticStatus is 'ready', say you found no relevant notes. If it is 'indexing', say literal search found no relevant notes and semantic search is still indexing. If it is 'unavailable', say literal search found no relevant notes, semantic search is unavailable, and suggest Search all entries. Do not claim the notebook has no relevant notes when semantic search is incomplete or unavailable.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1 },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
      },
      async execute(args) {
        const input = parseNoteSearchInput(args);
        if (!input) throw agentFailure("invalid_tool_arguments");
        const outcome = await ctx.notes.search(ctx.actor, ctx.gameId, input, ctx.signal);
        return { data: outcome, label: "Searched the GM’s notes" };
      },
    },
    {
      name: "get_notes",
      description:
        "Read up to 3 saved note entries for the current game by their entryIds, usually from search_notes. Returns each entry's title and full plain text. IDs that do not exist or belong to another game appear in missingEntryIds with no entry data.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["entryIds"],
        properties: {
          entryIds: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: uuidSchema,
          },
        },
      },
      async execute(args) {
        const input = parseNoteReadInput(args);
        if (!input) throw agentFailure("invalid_tool_arguments");
        const outcome = await ctx.notes.read(ctx.actor, ctx.gameId, input.entryIds);
        return { data: outcome, label: "Read saved note entries" };
      },
    },
    {
      name: "read_throws",
      description:
        "Read recent public throws and private throws authored by the GM, oldest to newest. Use these IDs for rerolls.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const records = await ctx.visibleThrows();
        return {
          data: records.map(
            ({ id, private: privateRoll, kind, characterName, equipmentName, setup, outcome }) => ({
              id,
              private: privateRoll,
              kind,
              characterName,
              equipmentName,
              note: setup.note,
              outcome,
            }),
          ),
          label: "Read recent throws",
        };
      },
    },
  ];
}
