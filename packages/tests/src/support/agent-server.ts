import { once } from "node:events";
import { createServer, request } from "node:http";
import { inject } from "vite-plus/test";
import { createApplication } from "../../../backend/src/app.ts";
import { databaseFromPool } from "../../../backend/src/database/client.ts";
import { createConfiguration } from "../../../backend/src/config.ts";
import type { AgentProvider } from "../../../backend/src/modules/agent/types.ts";
import { seedPool } from "./seed.ts";

/** Per-scenario backend, using the suite's database and shared Vite asset server.
 * Restart the real application without changing the browser origin or session cookies. */
export async function startAgentServer(provider?: AgentProvider) {
  const frontend = inject("frontendUrl");
  const pool = await seedPool();
  const makeApp = (next?: AgentProvider) =>
    createApplication(databaseFromPool(pool), createConfiguration({}), { agentProvider: next });
  let application = makeApp(provider);
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/api/")) {
      application.app(req, res);
      return;
    }
    const upstream = request(
      new URL(req.url ?? "/", frontend),
      { method: req.method, headers: req.headers },
      (incoming) => {
        res.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(res);
      },
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing browser test port");
  return {
    url: "http://127.0.0.1:" + address.port,
    restart(next?: AgentProvider) {
      application.dispose();
      application = makeApp(next);
    },
    async close() {
      application.dispose();
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
      await pool.end();
    },
  };
}
