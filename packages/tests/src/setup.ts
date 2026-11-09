import { databaseFromPool } from "../../backend/src/database/client.ts";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import pg from "pg";
import { createServer, type ViteDevServer } from "vite-plus";
import type { TestProject } from "vite-plus/test/node";
import { createApp } from "../../backend/src/app.ts";
import { applyMigrations } from "../../backend/src/migrations.ts";

// Each run uses its own schema and ephemeral ports, independent of development servers.
export default async function setup(project: TestProject) {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString)
    throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database");
  const schema = `browser_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString });
  let pool: pg.Pool | undefined;
  let backend: Server | undefined;
  let frontend: ViteDevServer | undefined;
  let schemaCreated = false;
  async function cleanup() {
    try {
      await frontend?.close();
      if (backend?.listening)
        await new Promise<void>((resolve, reject) =>
          backend!.close((error) => (error ? reject(error) : resolve())),
        );
      await pool?.end();
      if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
    await applyMigrations(pool);
    backend = createApp(databaseFromPool(pool)).listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      backend!.once("listening", resolve);
      backend!.once("error", reject);
    });
    const backendAddress = backend.address();
    if (!backendAddress || typeof backendAddress === "string")
      throw new Error("Backend has no TCP address");
    const frontendRoot = fileURLToPath(new URL("../../frontend/", import.meta.url));
    frontend = await createServer({
      root: frontendRoot,
      configFile: `${frontendRoot}vite.config.ts`,
      server: {
        host: "127.0.0.1",
        port: 0,
        proxy: {
          "/api": { target: `http://127.0.0.1:${backendAddress.port}`, changeOrigin: false },
        },
      },
    });
    await frontend.listen();
    const address = frontend.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Frontend has no TCP address");
    project.provide("frontendUrl", `http://127.0.0.1:${address.port}`);
    project.provide("databaseUrl", connectionString);
    project.provide("databaseSchema", schema);
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
