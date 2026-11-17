import { spawn } from "node:child_process";
import { globSync } from "node:fs";
import { constants } from "node:os";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

let child;
let interrupted;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = 128 + constants.signals[signal];
    child?.kill(signal);
  });
}

async function startPostgres() {
  console.log("Starting disposable PostgreSQL 17 for integration tests...");
  try {
    return await new PostgreSqlContainer("postgres:17").start();
  } catch (cause) {
    throw new Error(
      "Could not start test PostgreSQL. Check that Docker or Podman is running and accessible.",
      { cause },
    );
  }
}

async function stopPostgres(postgres) {
  const options = { timeout: 10_000 };
  try {
    await postgres.stop(options);
  } catch (error) {
    if (error.statusCode !== 500) throw error;
    // The runtime can fail removal after it has already stopped PostgreSQL.
    await postgres.stop(options);
  }
}

async function runSuites(connectionString) {
  const env = { ...process.env, TEST_DATABASE_URL: connectionString };
  const commands = [
    [
      "exec",
      "vp",
      "test",
      "--run",
      "packages/backend/src/migrations.test.ts",
      ...globSync("packages/backend/src/**/*.integration.test.ts").sort(),
    ],
    ["--filter", "@rpg-engine/tests", "test:api", "--run"],
    ["--filter", "@rpg-engine/tests", "test", "--run"],
  ];

  for (const args of commands) {
    if (interrupted) return interrupted;
    const exitCode = await new Promise((resolve, reject) => {
      child = spawn("pnpm", args, { env, stdio: "inherit" });
      child.once("error", reject);
      child.once("close", (code, signal) => {
        child = undefined;
        resolve(code ?? 128 + constants.signals[signal]);
      });
    });
    if (exitCode) return exitCode;
  }
  return 0;
}

const postgres = await startPostgres();
try {
  process.exitCode = await runSuites(postgres.getConnectionUri());
} finally {
  await stopPostgres(postgres);
  if (interrupted) process.exitCode = interrupted;
}
