import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { verifyCsrfConfiguration } from "./csrf.ts";

afterEach(() => vi.unstubAllEnvs());

describe("CSRF configuration", () => {
  it("requires a sufficiently long secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSRF_SECRET", "short");
    expect(() => verifyCsrfConfiguration()).toThrow("CSRF_SECRET");
    vi.stubEnv("CSRF_SECRET", "production-test-secret-with-32-bytes");
    expect(verifyCsrfConfiguration()).toBe("production-test-secret-with-32-bytes");
  });
});
