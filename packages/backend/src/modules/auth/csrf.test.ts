import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createConfiguration } from "../../config.ts";
import { verifyCsrfConfiguration } from "./csrf.ts";

afterEach(() => vi.unstubAllEnvs());

describe("CSRF configuration", () => {
  it("requires a sufficiently long secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXIES", "none");
    vi.stubEnv("CSRF_SECRET", "short");
    expect(() => verifyCsrfConfiguration(createConfiguration())).toThrow("CSRF_SECRET");
    vi.stubEnv("CSRF_SECRET", "production-test-secret-with-32-bytes");
    expect(verifyCsrfConfiguration(createConfiguration())).toBe("production-test-secret-with-32-bytes");
  });
});
