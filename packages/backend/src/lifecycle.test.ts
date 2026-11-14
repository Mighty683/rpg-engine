import { createServer, type Server } from "node:http";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createShutdown } from "./lifecycle.ts";

afterEach(() => vi.useRealTimers());

it("drains an open SSE connection before closing the database and shares repeated shutdown", async () => {
  let closeStream = () => {};
  const order: string[] = [];
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(": connected\n\n");
    closeStream = () => response.end();
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const dispose = vi.fn(() => {
    order.push("dispose");
    closeStream();
  });
  const closeDatabase = vi.fn(async () => {
    order.push("database");
    expect(server.listening).toBe(false);
  });
  const shutdown = createShutdown(server, { dispose }, closeDatabase, { timeoutMs: 1000 });
  const response = await fetch(`http://127.0.0.1:${address.port}`);
  const reader = response.body!.getReader();
  await reader.read();
  const first = shutdown();
  expect(shutdown()).toBe(first);
  await first;
  expect(await reader.read()).toEqual({ value: undefined, done: true });
  expect(order).toEqual(["dispose", "database"]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(closeDatabase).toHaveBeenCalledOnce();
});

it("forces connections closed when the deadline expires and exposes the failure", async () => {
  vi.useFakeTimers();
  const server = { close: vi.fn(), closeAllConnections: vi.fn(), on: vi.fn(), off: vi.fn() };
  const closeDatabase = vi.fn(async () => {});
  const shutdown = createShutdown(
    server as unknown as Server,
    { dispose: vi.fn() },
    closeDatabase,
    { timeoutMs: 10 },
  );
  const result = shutdown();
  const rejected = expect(result).rejects.toThrow("Shutdown deadline exceeded");
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(server.closeAllConnections).toHaveBeenCalledOnce();
  expect(closeDatabase).not.toHaveBeenCalled();
  expect(shutdown()).toBe(result);
});
