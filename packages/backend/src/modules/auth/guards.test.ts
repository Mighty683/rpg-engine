import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { requireWriteOrigin } from "./guards.ts";

function request(origin: string | undefined, host: string): Request {
  return { get: (header: string) => header === "origin" ? origin : host } as Request;
}

afterEach(() => vi.unstubAllEnvs());

describe("write origin", () => {
  it("accepts the actual local proxy origin and rejects missing or cross-origin writes", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", undefined);
    expect(() => requireWriteOrigin(request("http://localhost:5175", "localhost:5175"))).not.toThrow();
    expect(() => requireWriteOrigin(request("http://127.0.0.1:5174", "127.0.0.1:5174"))).not.toThrow();
    expect(() => requireWriteOrigin(request("http://localhost:5173", "localhost:5175"))).toThrow();
    expect(() => requireWriteOrigin(request("http://evil.test", "localhost:5175"))).toThrow();
    expect(() => requireWriteOrigin(request(undefined, "localhost:5175"))).toThrow();
    expect(() => requireWriteOrigin(request("http://evil.test", "evil.test"))).toThrow();
  });

  it("requires the configured origin when set, and in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", undefined);
    expect(() => requireWriteOrigin(request("http://localhost:5175", "localhost:5175"))).toThrow();
    vi.stubEnv("APP_ORIGIN", "https://rpg.example");
    expect(() => requireWriteOrigin(request("https://rpg.example", "internal:3000"))).not.toThrow();
    expect(() => requireWriteOrigin(request("https://other.example", "internal:3000"))).toThrow();
  });
});
