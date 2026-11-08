import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Database } from "./database/types.ts";
import { createApp } from "./app.ts";

afterEach(() => vi.unstubAllEnvs());

describe("production security configuration", () => {
  it("requires an explicit trusted proxy policy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSRF_SECRET", "production-test-secret-with-32-bytes");
    vi.stubEnv("TRUSTED_PROXIES", "");
    expect(() => createApp({} as Database)).toThrow("TRUSTED_PROXIES");
    vi.stubEnv("TRUSTED_PROXIES", "none");
    expect(createApp({} as Database).get("trust proxy")).toBe(false);
    vi.stubEnv("TRUSTED_PROXIES", "127.0.0.1/32");
    const trust = createApp({} as Database).get("trust proxy fn") as (
      address: string,
      index: number,
    ) => boolean;
    expect(trust("127.0.0.1", 0)).toBe(true);
    expect(trust("198.51.100.2", 0)).toBe(false);
  });
});
