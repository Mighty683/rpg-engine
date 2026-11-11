import { describe, expect, it, vi } from "vite-plus/test";
import { createSSRApp } from "vue";
import { apiServicesKey, useApiServices } from "./api-services";
import type { ApiServices } from "./types";

describe("API service injection", () => {
  it("rejects missing composition rather than falling back to production", () => {
    const app = createSSRApp({});
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() => app.runWithContext(useApiServices)).toThrow(
        "API services must be provided by the application composition root",
      );
    } finally {
      warning.mockRestore();
    }
  });

  it("returns the supplied replacement services unchanged", async () => {
    const current = vi.fn().mockResolvedValue({ account: null });
    const services = { auth: { current } } as unknown as ApiServices;
    const app = createSSRApp({});
    app.provide(apiServicesKey, services);

    const injected = app.runWithContext(useApiServices);
    expect(injected).toBe(services);
    await expect(injected.auth.current()).resolves.toEqual({ account: null });
    expect(current).toHaveBeenCalledOnce();
  });
});
