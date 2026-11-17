import type { AgentProvider } from "../../../backend/src/modules/agent/types.ts";
import { AgentPage } from "../pages/agent-page.ts";
import { GameTablePage } from "../pages/game-table-page.ts";
import { startAgentServer } from "./agent-server.ts";
import { tableReaderProvider } from "./agent-provider.ts";
import { seedGame, seedPool, type SeededGame } from "./seed.ts";
import type { BrowserWorld } from "./world.ts";
export interface AgentWorld extends BrowserWorld {
  agent: AgentPage;
  agentGame: SeededGame;
  agentServer: Awaited<ReturnType<typeof startAgentServer>>;
  reading?: { first?: string; offset: number };
  agentRequests: number;
}

export async function setupAgentGame(w: AgentWorld, provider: AgentProvider = tableReaderProvider) {
  w.agentGame = await seedGame();
  const pool = await seedPool();
  try {
    await pool.query("UPDATE characters SET name='Robert' WHERE id=$1", [
      w.agentGame.gmCharacterId,
    ]);
    await pool.query("UPDATE characters SET name='Christine' WHERE id=$1", [
      w.agentGame.playerCharacterId,
    ]);
  } finally {
    await pool.end();
  }
  w.agentServer = await startAgentServer(provider);
  w.agent = new AgentPage(w.page);
}

export async function openAgentGame(w: AgentWorld, role: "gm" | "player", width = 793) {
  await w.page.setViewportSize({ width, height: 880 });
  const table = new GameTablePage(w.page);
  const account = w.agentGame[role];
  await table.signIn(w.agentServer.url, account.username, account.password);
  await table.openGame(w.agentServer.url, w.agentGame.gameId);
  if (role === "gm") await w.agent.open();
}
