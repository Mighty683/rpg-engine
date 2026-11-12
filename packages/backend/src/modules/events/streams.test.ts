import type { Response } from "express";
import { expect, it, vi } from "vite-plus/test";
import { createGameEvents } from "./streams.ts";

it("isolates subscriptions and revocation between event service instances", () => {
  const first = createGameEvents();
  const second = createGameEvents();
  const response = { write: vi.fn(), end: vi.fn(), destroyed: false, writableEnded: false };
  const stream = first.registerStream(
    "game",
    "account",
    "session",
    response as unknown as Response,
  );
  expect(stream.start()).toBe(true);
  second.publishGameEvent("game", { type: "roster" });
  second.closeSessionStreams("session");
  expect(response.write).not.toHaveBeenCalled();
  expect(response.end).not.toHaveBeenCalled();
  first.publishGameEvent("game", { type: "roster" });
  expect(response.write).toHaveBeenCalledOnce();
  first.closeSessionStreams("session");
  expect(response.end).toHaveBeenCalledOnce();
  first.publishGameEvent("game", { type: "roster" });
  expect(response.write).toHaveBeenCalledOnce();
});

it("sends private hints only to active sessions of the author in the same game", () => {
  const events = createGameEvents();
  const responses = Array.from({ length: 4 }, () => ({
    write: vi.fn(),
    end: vi.fn(),
    destroyed: false,
    writableEnded: false,
  }));
  for (const [index, account, game] of [
    [0, "author", "game"],
    [1, "author", "game"],
    [2, "other", "game"],
    [3, "author", "other"],
  ] as const) {
    events
      .registerStream(game, account, `session-${index}`, responses[index] as unknown as Response)
      .start();
  }
  events.publishGameEvent("game", { type: "throws" }, "author");
  expect(responses.map((response) => response.write.mock.calls.length)).toEqual([1, 1, 0, 0]);
});
