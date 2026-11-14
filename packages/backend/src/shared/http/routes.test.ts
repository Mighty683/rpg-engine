import { afterEach, expect, it, vi } from "vite-plus/test";
import express from "express";
import { Application, Controller, RequestError, Route } from "arrow-express";
import type { Server } from "node:http";
import { mountRoutes } from "./routes.ts";
import { errorBoundary, requestIdentity } from "./error-boundary.ts";

let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server ? server.close((error) => (error ? reject(error) : resolve())) : resolve(),
  );
});

it("preserves composed routes and expected errors while forwarding unexpected failures to sanitized logging", async () => {
  const app = express();
  const log = vi.fn();
  app.use(requestIdentity, express.json({ limit: "1kb" }));
  const failure = new Error("SQL includes secret-token and password");
  mountRoutes(
    app,
    Application()
      .prefix("api")
      .registerControllers(
        Controller()
          .prefix("probe/:token")
          .handler(async () => ({ value: "composed" }))
          .registerRoutes(
            Route<{ value: string }>()
              .method("get")
              .path("")
              .handler((_request, response, context) => {
                response.status(201);
                return context;
              }),
            Route<{ value: string }>()
              .method("post")
              .path("")
              .handler(async () => {
                throw failure;
              }),
            Route<{ value: string }>()
              .method("put")
              .path("")
              .handler(async () => {
                throw new RequestError(409, { error: { code: "stale_revision" } });
              }),
            Route<{ value: string }>()
              .method("delete")
              .path("")
              .handler(async () => {
                throw new Error("query", {
                  cause: Object.assign(new Error("secret query"), { code: "55P03" }),
                });
              }),
          ),
        Controller()
          .prefix("guard")
          .handler(() => {
            throw failure;
          })
          .registerRoutes(
            Route()
              .method("get")
              .path("")
              .handler(() => null),
          ),
        Controller()
          .prefix("ended")
          .registerRoutes(
            Route()
              .method("get")
              .path("")
              .handler((_request, response) => {
                response.status(204).end();
              }),
          ),
      ),
  );
  app.use(errorBoundary(new Error("csrf"), log));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const origin = `http://127.0.0.1:${address.port}`;
  const path = `${origin}/api/probe/secret-token?password=secret`;
  const success = await fetch(path);
  expect(success.status).toBe(201);
  expect(await success.json()).toEqual({ value: "composed" });
  const response = await fetch(path, {
    method: "POST",
    headers: { "x-request-id": "untrusted", cookie: "secret-token" },
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: "server_error", message: "Request failed." },
  });
  const requestId = response.headers.get("x-request-id");
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(log).toHaveBeenLastCalledWith({
    requestId,
    method: "POST",
    route: "/api/probe/:token",
    status: 500,
    databaseCode: undefined,
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|password|SQL|untrusted/);
  const conflict = await fetch(path, { method: "PUT" });
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toEqual({ error: { code: "stale_revision" } });
  expect(log).toHaveBeenCalledTimes(1);
  const timeout = await fetch(path, { method: "DELETE" });
  expect(timeout.status).toBe(503);
  expect(await timeout.json()).toEqual({
    error: { code: "database_busy", message: "Database busy. Try again." },
  });
  expect(log.mock.lastCall![0]).toMatchObject({ status: 503, databaseCode: "55P03" });
  const malformed = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toMatchObject({ error: { code: "bad_request" } });
  expect((await fetch(`${origin}/api/guard`)).status).toBe(500);
  expect((await fetch(`${origin}/api/ended`)).status).toBe(204);
});
