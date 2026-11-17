import type { AgentCompletion, AgentProvider } from "../../../backend/src/modules/agent/types.ts";

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

/** Deterministic provider for the party and skill-advice browser scenarios. */
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
