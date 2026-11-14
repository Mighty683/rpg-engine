import pg from "pg";
import { databaseFromPool } from "./database/client.ts";
import { createApplication } from "./app.ts";
import { createConfiguration } from "./config.ts";
import { createShutdown } from "./lifecycle.ts";

const config = createConfiguration();
const connectionString = config.databaseUrl;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const port = config.port;
const application = createApplication(databaseFromPool(pool), config);
const server = application.app.listen(port, "127.0.0.1", () =>
  console.log(`Backend listening on http://127.0.0.1:${port}`),
);
const shutdown = createShutdown(server, application, () => pool.end());
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown().catch((error) => {
      console.error("Backend shutdown failed", error);
      process.exit(1);
    });
  });
}
