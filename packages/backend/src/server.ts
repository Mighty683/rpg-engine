import pg from "pg";
import { databaseFromPool } from "./database/client.ts";
import { createApp } from "./app.ts";
import { createConfiguration } from "./config.ts";

const config = createConfiguration();
const connectionString = config.databaseUrl;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString });
const port = config.port;
const server = createApp(databaseFromPool(pool), config).listen(port, "127.0.0.1", () =>
  console.log(`Backend listening on http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      void pool.end();
    }),
  );
}
