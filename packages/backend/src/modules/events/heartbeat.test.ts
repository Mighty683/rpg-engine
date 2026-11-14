import { afterEach, expect, it, vi } from "vite-plus/test";
import { startHeartbeat } from "./heartbeat.ts";

afterEach(() => vi.useRealTimers());

it("does not overlap checks and stops an in-flight check from writing after cancellation", async () => {
  vi.useFakeTimers();
  let complete!: (allowed: boolean) => void;
  const check = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        complete = resolve;
      }),
  );
  const write = vi.fn(() => true);
  const close = vi.fn();
  const stop = startHeartbeat(check, write, close, 10);
  await vi.advanceTimersByTimeAsync(100);
  expect(check).toHaveBeenCalledOnce();
  complete(true);
  await vi.advanceTimersByTimeAsync(10);
  expect(check).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledOnce();
  stop();
  complete(true);
  await vi.advanceTimersByTimeAsync(100);
  expect(write).toHaveBeenCalledOnce();
  expect(check).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
});

it.each(["denied", "failed", "slow"])(
  "closes a %s connection without rescheduling",
  async (kind) => {
    vi.useFakeTimers();
    const check = vi.fn(async () => {
      if (kind === "failed") throw new Error("database unavailable");
      return kind !== "denied";
    });
    const write = vi.fn(() => kind !== "slow");
    const close = vi.fn();
    startHeartbeat(check, write, close, 10);
    await vi.advanceTimersByTimeAsync(100);
    expect(check).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledTimes(kind === "slow" ? 1 : 0);
  },
);
