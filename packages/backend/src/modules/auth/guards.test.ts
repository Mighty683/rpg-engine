import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createConfiguration } from "../../config.ts";
import { requireWriteOrigin } from "./guards.ts";

function request(origin: string | undefined, host: string): Request {
  return { get: (header: string) => (header === "origin" ? origin : host) } as Request;
}

afterEach(() => vi.unstubAllEnvs());

describe("write origin", () => {
  it("accepts any origin in development when APP_ORIGIN is unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", undefined);
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://localhost:5173", "127.0.0.1:3000")),
    ).not.toThrow();
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://127.0.0.1:5174", "127.0.0.1:5174")),
    ).not.toThrow();
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://evil.test", "localhost:5175")),
    ).not.toThrow();
    expect(() =>
      requireWriteOrigin(createConfiguration(), request(undefined, "localhost:5175")),
    ).not.toThrow();
  });

  it("still enforces APP_ORIGIN in development when set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://localhost:5173");
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://localhost:5173", "127.0.0.1:3000")),
    ).not.toThrow();
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://evil.test", "127.0.0.1:3000")),
    ).toThrow();
  });

  it("requires the configured origin when set, and in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXIES", "none");
    vi.stubEnv("CSRF_SECRET", "production-test-secret-with-32-bytes");
    vi.stubEnv("INVITATION_SECRET", "production-test-secret-with-32-bytes");
    vi.stubEnv("APP_ORIGIN", undefined);
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("http://localhost:5175", "localhost:5175")),
    ).toThrow();
    vi.stubEnv("APP_ORIGIN", "https://rpg.example");
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("https://rpg.example", "internal:3000")),
    ).not.toThrow();
    expect(() =>
      requireWriteOrigin(createConfiguration(), request("https://other.example", "internal:3000")),
    ).toThrow();
  });
});
