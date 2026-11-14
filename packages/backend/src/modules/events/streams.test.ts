import { EventEmitter } from "node:events";
import type { Response } from "express";
import { expect, it, vi } from "vite-plus/test";
import { createGameEvents } from "./streams.ts";

function connection() {
  const response = Object.assign(new EventEmitter(), {
    write: vi.fn(() => true),
    end: vi.fn(),
    destroy: vi.fn(),
    destroyed: false,
    writableEnded: false,
  });
  response.end.mockImplementation(() => {
    response.writableEnded = true;
    response.emit("close");
  });
  response.destroy.mockImplementation(() => {
    response.destroyed = true;
    response.emit("close");
  });
  return { response, transport: response as unknown as Response };
}

it("counts pending connections across sessions, releases exactly once, and isolates service instances", () => {
  const events = createGameEvents({ maxConnectionsPerAccount: 1, maxConnections: 2 });
  const alreadyClosed = connection();
  alreadyClosed.response.destroyed = true;
  expect(events.registerStream("game", "account", "closed", alreadyClosed.transport).start()).toBe(
    false,
  );
  const first = connection();
  const stream = events.registerStream("game", "account", "session", first.transport);
  expect(() =>
    events.registerStream("other", "account", "session-2", connection().transport),
  ).toThrowError(expect.objectContaining({ code: "stream_capacity" }));
  const other = connection();
  events.registerStream("other", "another", "session-3", other.transport).start();
  expect(() =>
    events.registerStream("game", "third", "session-4", connection().transport),
  ).toThrowError(expect.objectContaining({ code: "stream_capacity" }));
  createGameEvents().closeSessionStreams("session");
  expect(first.response.end).not.toHaveBeenCalled();
  first.response.emit("close");
  stream.remove();
  expect(stream.start()).toBe(false);
  events.registerStream("game", "account", "replacement", connection().transport).start();
  expect(() =>
    events.registerStream("game", "account", "excess", connection().transport),
  ).toThrow();
  events.dispose();
});

it("restricts private hints and preserves unrelated sessions during revocation", () => {
  const events = createGameEvents();
  const responses = Array.from({ length: 4 }, connection);
  for (const [index, account, game] of [
    [0, "author", "game"],
    [1, "author", "game"],
    [2, "other", "game"],
    [3, "author", "other"],
  ] as const)
    events.registerStream(game, account, `session-${index}`, responses[index]!.transport).start();
  events.publishGameEvent("game", { type: "throws" }, "author");
  expect(responses.map(({ response }) => response.write.mock.calls.length)).toEqual([1, 1, 0, 0]);
  events.closeSessionStreams("session-0");
  expect(responses.map(({ response }) => response.end.mock.calls.length)).toEqual([1, 0, 0, 0]);
  events.closeMemberStreams("game", "author");
  expect(responses.map(({ response }) => response.end.mock.calls.length)).toEqual([1, 1, 0, 0]);
  events.dispose();
});

it("disconnects slow and failed writers without interrupting healthy recipients", () => {
  const events = createGameEvents();
  const slow = connection();
  const failed = connection();
  const healthy = connection();
  slow.response.write.mockReturnValue(false);
  failed.response.write.mockImplementation(() => {
    throw new Error("broken");
  });
  failed.response.destroy.mockImplementation(() => {
    throw new Error("broken close");
  });
  for (const [index, stream] of [slow, failed, healthy].entries())
    events.registerStream("game", `account-${index}`, `session-${index}`, stream.transport).start();
  events.publishGameEvent("game", { type: "roster" });
  expect(slow.response.destroy).toHaveBeenCalledOnce();
  expect(failed.response.destroy).toHaveBeenCalledTimes(2);
  expect(healthy.response.write).toHaveBeenCalledOnce();
  events.publishGameEvent("game", { type: "roster" });
  expect(slow.response.write).toHaveBeenCalledOnce();
  expect(healthy.response.write).toHaveBeenCalledTimes(2);
  events.dispose();
});

it("disposes active and pending subscriptions idempotently and prevents subsequent registration", () => {
  const events = createGameEvents();
  const pending = connection();
  const active = connection();
  const stream = events.registerStream("game", "account", "pending", pending.transport);
  events.registerStream("game", "account", "active", active.transport).start();
  events.dispose();
  events.dispose();
  expect(stream.start()).toBe(false);
  expect(pending.response.end).toHaveBeenCalledOnce();
  expect(active.response.end).toHaveBeenCalledOnce();
  expect(() =>
    events.registerStream("game", "account", "new", connection().transport),
  ).toThrowError(expect.objectContaining({ code: "server_stopping" }));
});

it("rejects unsafe stream settings before accepting requests", () => {
  for (const value of [0, -1, 1.5, Infinity])
    expect(() => createGameEvents({ maxConnections: value })).toThrow("positive integer");
});
