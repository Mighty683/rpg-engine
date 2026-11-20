import { describe, expect, it, vi } from "vite-plus/test";
import type { AgentToolContext } from "../modules/agent/types.ts";
import { compileObjectSchema } from "../shared/validation/parse.ts";
import { createAgentReads } from "./agent-reads.ts";
import type { GameNotesRetrieval } from "../modules/game-notes/types.ts";

const gameId = "9e64d5c8-2f9b-470d-a7f0-715c0ee265e8";
const entryId = "6b8d3f79-9e62-42d5-9d44-16a171522b41";
const actor = { accountId: "a".repeat(36), sessionId: "b".repeat(36) };
const signal = new AbortController().signal;

function reads() {
  return {
    search: vi.fn<GameNotesRetrieval["search"]>(async (_actor, _gameId, _input) => ({
      matches: [{ entryId, title: "Compass cache", excerpt: "silver compass", source: "literal" }],
      semanticStatus: "ready",
    })),
    read: vi.fn<GameNotesRetrieval["read"]>(async (_actor, _gameId, entryIds) => ({
      entries: entryIds.map((id) => ({
        entryId: id,
        title: "Compass cache",
        text: "The ferryman keeps a silver compass.",
        updatedAt: "2026-11-20T10:00:00.000Z",
      })),
      missingEntryIds: [],
    })),
  } satisfies GameNotesRetrieval;
}

function toolsWith(notes: ReturnType<typeof reads>) {
  const context = {
    actor,
    gameId,
    reauthorize: vi.fn(async () => {}),
    signal,
    message: "ignored",
    characters: {},
    npcs: {},
    throws: {},
    notes,
    table: { party: [], npcs: [] },
    visibleThrows: vi.fn(async () => []),
  } as unknown as AgentToolContext;
  const tools = createAgentReads(context);
  return { tools, find: (name: string) => tools.find((tool) => tool.name === name)! };
}

describe("agent read tools", () => {
  it("registers both note tools with strict object schemas", () => {
    const { find } = toolsWith(reads());
    const search = find("search_notes");
    const read = find("get_notes");
    expect(search.parameters).toMatchObject({
      additionalProperties: false,
      required: ["query"],
    });
    expect(read.parameters).toMatchObject({
      additionalProperties: false,
      required: ["entryIds"],
    });
    const validateSearch = compileObjectSchema(search.parameters);
    expect(validateSearch({ query: "compass", limit: 10 })).toBe(true);
    expect(validateSearch({ query: "compass", limit: 11 })).toBe(false);
    expect(validateSearch({ query: 5 })).toBe(false);
    expect(validateSearch({ query: "compass", extra: "no" })).toBe(false);
    expect(validateSearch({})).toBe(false);
    const validateRead = compileObjectSchema(read.parameters);
    expect(validateRead({ entryIds: [entryId, entryId] })).toBe(false);
    expect(validateRead({ entryIds: [entryId, entryId, entryId, entryId] })).toBe(false);
    expect(validateRead({ entryIds: [] })).toBe(false);
    expect(validateRead({ entryIds: [entryId, "nope"] })).toBe(false);
    expect(validateRead({ entryIds: entryId })).toBe(false);
  });

  it("forwards validated search input and never repeats note text in the label", async () => {
    const notes = reads();
    const { find } = toolsWith(notes);
    const result = await find("search_notes")!.execute({ query: "  compass  ", limit: 4 });
    expect(notes.search).toHaveBeenCalledWith(actor, gameId, { text: "compass", limit: 4 }, signal);
    expect(result.label).toBe("Searched the GM’s notes");
    expect(result.label).not.toContain("compass");
    expect(result.data).toMatchObject({ semanticStatus: "ready" });
  });

  it("rejects invalid search and read inputs as tool argument failures", async () => {
    const notes = reads();
    const { find } = toolsWith(notes);
    await expect(find("search_notes")!.execute({ query: "   " })).rejects.toMatchObject({
      code: "agent_failed",
      reason: "invalid_tool_arguments",
    });
    await expect(find("search_notes")!.execute({ query: "x", limit: 0 })).rejects.toMatchObject({
      reason: "invalid_tool_arguments",
    });
    await expect(find("get_notes")!.execute({ entryIds: [] })).rejects.toMatchObject({
      reason: "invalid_tool_arguments",
    });
    expect(notes.search).not.toHaveBeenCalled();
    expect(notes.read).not.toHaveBeenCalled();
  });

  it("reads entries by ID in request order with a fixed label", async () => {
    const notes = reads();
    const { find } = toolsWith(notes);
    const result = await find("get_notes")!.execute({ entryIds: [entryId] });
    expect(notes.read).toHaveBeenCalledWith(actor, gameId, [entryId]);
    expect(result).toMatchObject({
      label: "Read saved note entries",
      data: {
        entries: [
          {
            entryId,
            title: "Compass cache",
            text: "The ferryman keeps a silver compass.",
            updatedAt: "2026-11-20T10:00:00.000Z",
          },
        ],
        missingEntryIds: [],
      },
    });
  });
});
