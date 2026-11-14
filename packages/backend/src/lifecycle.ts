import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { defaultShutdownTimeoutMs } from "./types.ts";
import type { ApplicationRuntime, ShutdownOptions } from "./types.ts";

/** Stop accepting requests, dispose live streams, then drain HTTP before closing the database. */
export function createShutdown(
  server: Server,
  runtime: Pick<ApplicationRuntime, "dispose">,
  closeDatabase: () => Promise<void>,
  options: ShutdownOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? defaultShutdownTimeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new Error("Shutdown timeout must be a positive integer");
  let pending: Promise<void> | undefined;
  const closeWhenIdle = (_request: IncomingMessage, response: ServerResponse) => {
    response.once("finish", () => {
      if (pending) server.closeIdleConnections();
    });
  };
  server.on("request", closeWhenIdle);

  async function shutdown() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        server.closeAllConnections();
        reject(new Error("Shutdown deadline exceeded"));
      }, timeoutMs);
    });
    const drain = async () => {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      runtime.dispose();
      await closed;
      await closeDatabase();
    };
    try {
      await Promise.race([drain(), deadline]);
    } finally {
      clearTimeout(timer);
      server.off("request", closeWhenIdle);
    }
  }

  return () => (pending ??= shutdown());
}
