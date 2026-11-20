import type { AgentCompletion, AgentProvider } from "../../../backend/src/modules/agent/types.ts";
import type { NoteEmbeddings } from "../../../backend/src/modules/game-notes/types.ts";

export function agentReply(text: string): AgentCompletion {
  return { text, calls: [], inputTokens: 100, outputTokens: 15 };
}
export function agentTool(name: string, args: Record<string, unknown>): AgentCompletion {
  return {
    text: "",
    calls: [{ id: "call00001", name, arguments: JSON.stringify(args) }],
    inputTokens: 100,
    outputTokens: 15,
  };
}
export const tableReaderProvider: AgentProvider = {
  async complete({ messages }) {
    const input = JSON.parse(messages[1]!.content) as {
      currentTable: { party: { id: string; name: string }[] };
    };
    const latest = messages.at(-1)!;
    if (latest.role === "tool") {
      const info = JSON.parse(latest.content) as {
        learnedSkills: { name: string; description: string }[];
      };
      const skill = info.learnedSkills.find((s) => s.description.includes("accuracy"));
      if (!skill) throw Error("Accuracy skill missing from projected sheet");
      return agentReply(skill.name + " — " + skill.description);
    }
    if (latest.content.includes("better shot")) {
      const robert = input.currentTable.party.find((row) => row.name === "Robert");
      if (!robert) throw Error("Robert is missing from active table context");
      return agentTool("read_character", { id: robert.id, sections: ["skills"] });
    }
    return agentReply(
      "At the table: " + input.currentTable.party.map((row) => row.name).join(", "),
    );
  },
};

/**
 * Deterministic note embeddings for browser scenarios: every input embeds to a
 * one-hot vector at a position derived from its text, so no text ever leaves
 * the process and unrelated inputs stay below the similarity cutoff even if
 * the background indexer ever runs during a scenario.
 */
export const deterministicNoteEmbeddings: NoteEmbeddings = {
  async embed(inputs) {
    return inputs.map((input) => {
      let hash = 0;
      for (const character of input) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
      const vector = Array.from({ length: 1024 }, () => 0);
      vector[Math.abs(hash) % 1024] = 1;
      return vector;
    });
  },
};

/** Maps the GM's message to the literal search phrase the scenario's notes contain or lack. */
const searchPhrase = (message: string) =>
  message.includes("observatory") ? "observatory password" : "cross the marsh";

/** Deterministic provider for the game-notes retrieval scenario (E2E-07). */
export const notesReaderProvider: AgentProvider = {
  async complete({ messages }) {
    const latest = messages.at(-1)!;
    if (latest.role !== "tool")
      return agentTool("search_notes", { query: searchPhrase(latest.content) });
    if (latest.name === "search_notes") {
      const outcome = JSON.parse(latest.content) as {
        matches?: { entryId: string }[];
        semanticStatus: "ready" | "indexing" | "unavailable";
      };
      if (outcome.matches?.length)
        return agentTool("get_notes", { entryIds: [outcome.matches[0]!.entryId]! });
      if (outcome.semanticStatus === "ready")
        return agentReply("I found no relevant notes in this game.");
      if (outcome.semanticStatus === "indexing")
        return agentReply(
          "Literal search found no relevant notes. Semantic search is still indexing.",
        );
      return agentReply(
        "Literal search found no relevant notes. Semantic search is unavailable. You can use Search all entries.",
      );
    }
    const outcome = JSON.parse(latest.content) as { entries?: { title: string; text: string }[] };
    const entry = outcome.entries?.[0];
    return agentReply(entry ? `From “${entry.title}”: ${entry.text}` : "The note is empty.");
  },
};
