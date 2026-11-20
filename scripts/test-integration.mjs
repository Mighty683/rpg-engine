import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { constants } from "node:os";

const containerName = `rpg-integration-${randomUUID().slice(0, 8)}`;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    podman(["rm", "-f", "-t", "0", containerName]);
    process.exit(128 + constants.signals[signal]);
  });
}

function podman(args, options) {
  return spawnSync("podman", args, { encoding: "utf8", ...options });
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", resolve);
  });
}

async function startPostgres() {
  console.log("Starting disposable PostgreSQL 17 (pgvector image) for integration tests...");
  const started = podman([
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=test",
    "-e",
    "POSTGRES_PASSWORD=test",
    "-e",
    "POSTGRES_DB=test",
    "-p",
    "127.0.0.1::5432",
    "docker.io/pgvector/pgvector:pg17",
  ]);
  if (started.error?.code === "ENOENT") {
    throw new Error(
      "podman not found. Install Podman: https://podman.io/getting-started/installation",
    );
  }
  if (started.status !== 0) {
    throw new Error(`Could not start test PostgreSQL: ${started.stderr}`);
  }
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (
      podman(["exec", containerName, "pg_isready", "-h", "127.0.0.1", "-U", "test", "-d", "test"])
        .status === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    const logs = podman(["logs", containerName]);
    throw new Error(
      `PostgreSQL did not become ready within 60s:\n${logs.stdout ?? ""}${logs.stderr ?? ""}`,
    );
  }
  const extension = podman([
    "exec",
    containerName,
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    "test",
    "-d",
    "test",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public",
  ]);
  if (extension.status !== 0) {
    throw new Error(`Could not enable pgvector: ${extension.stderr ?? extension.error}`);
  }
  const port = podman(["port", containerName, "5432"]).stdout?.trim().split("\n")[0];
  const host = port?.split(":").slice(-2).join(":");
  if (!host) {
    throw new Error(
      `Could not read mapped PostgreSQL port: ${podman(["logs", containerName]).stdout}`,
    );
  }
  return `postgresql://test:test@${host}/test`;
}

function stopPostgres() {
  podman(["rm", "-f", "-t", "0", containerName]);
}

function runBrowserSuite(containerized, env) {
  // Parallel cold Vite transforms can starve browser navigation and live-update assertions.
  const browserArgs = ["--run", "--maxWorkers=1"];
  if (!containerized) {
    return run("pnpm", ["--filter", "@rpg-engine/tests", "test", ...browserArgs], env);
  }
  // The browser suite runs in the official Playwright image: no local Chromium install needed,
  // and Chromium's sandbox works where unprivileged user namespaces are restricted (e.g. Ubuntu 24.04).
  const playwrightVersion = JSON.parse(
    readFileSync(new URL("../packages/tests/package.json", import.meta.url), "utf8"),
  ).devDependencies.playwright;
  const root = process.cwd();
  return run(
    "podman",
    [
      "run",
      "--rm",
      "--userns=keep-id",
      "--network",
      "host",
      "--shm-size",
      "512m",
      "-v",
      `${root}:${root}`,
      "-w",
      `${root}/packages/tests`,
      "-e",
      `TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:${portFrom(env.TEST_DATABASE_URL)}/test`,
      "-e",
      "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright",
      `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
      "./node_modules/.bin/vitest",
      "--config",
      "vitest.config.ts",
      ...browserArgs,
    ],
    env,
  );
}

function portFrom(connectionString) {
  return new URL(connectionString).port;
}

async function runSuites(connectionString, containerized) {
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
  ];

  for (const args of commands) {
    const exitCode = await run("pnpm", args, env);
    if (exitCode !== 0) return exitCode;
  }
  return runBrowserSuite(containerized, env);
}

let exitCode;
const provided = process.env.TEST_DATABASE_URL;
try {
  if (provided) console.log("Using provided TEST_DATABASE_URL.");
  const connectionString = provided ?? (await startPostgres());
  exitCode = await runSuites(connectionString, provided === undefined);
} catch (error) {
  console.error(error.message ?? error);
  exitCode = 1;
} finally {
  if (!provided) stopPostgres();
}

process.exitCode = exitCode;
