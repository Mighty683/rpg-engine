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
