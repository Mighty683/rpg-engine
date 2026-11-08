import { expect, it } from "vite-plus/test";
import { createConfiguration } from "./config.ts";

it("captures independent settings and requires an explicit production proxy policy", () => {
  const env = {
    NODE_ENV: "production",
    TRUSTED_PROXIES: "127.0.0.1/32",
    APP_ORIGIN: "https://one.example",
  };
  const first = createConfiguration(env);
  env.APP_ORIGIN = "https://two.example";
  const second = createConfiguration(env);
  expect(first.appOrigin).toBe("https://one.example");
  expect(second.appOrigin).toBe("https://two.example");
  expect(first.trustedProxies).toEqual(["127.0.0.1/32"]);
  expect(() => createConfiguration({ NODE_ENV: "production" })).toThrow("TRUSTED_PROXIES");
});
