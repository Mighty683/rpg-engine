import type { AgentProvider } from "../../../backend/src/modules/agent/types.ts";
import { agentReply, agentTool } from "./agent-provider.ts";

export const editProvider: AgentProvider = {
  async complete({ messages }) {
    const last = messages.at(-1)!;
    if (last.role === "tool") return agentReply("The change is ready for review.");
    const { currentTable } = JSON.parse(messages[1]!.content);
    if (last.content.includes("Robert")) {
      const person = currentTable.party.find((row: { name: string }) => row.name === "Robert");
      return agentTool("prepare_character_edit", {
        id: person.id,
        changes: { resources: { hp: 8 } },
      });
    }
    const npc = currentTable.npcs.find((row: { name: string }) => row.name === "Agile");
    return agentTool("prepare_npc_edit", { id: npc.id, changes: { notes: "guarding the bridge" } });
  },
};
