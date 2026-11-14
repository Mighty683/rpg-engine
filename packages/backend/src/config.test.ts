import { expect, it } from "vite-plus/test";
import { createConfiguration } from "./config.ts";

it("captures independent settings and requires an explicit production proxy policy", () => {
  const env = {
    NODE_ENV: "production",
    TRUSTED_PROXIES: "127.0.0.1/32",
    CSRF_SECRET: "s".repeat(32),
    INVITATION_SECRET: "i".repeat(32),
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

it("enables development-only routes only in development mode", () => {
  expect(createConfiguration({ NODE_ENV: "development" }).development).toBe(true);
  expect(createConfiguration({}).development).toBe(false);
  expect(createConfiguration({ NODE_ENV: "test" }).development).toBe(false);
  expect(
    createConfiguration({
      NODE_ENV: "production",
      TRUSTED_PROXIES: "none",
      APP_ORIGIN: "https://app.example",
      CSRF_SECRET: "s".repeat(32),
      INVITATION_SECRET: "i".repeat(32),
    }).development,
  ).toBe(false);
});

const production = {
  NODE_ENV: "production",
  TRUSTED_PROXIES: "none",
  APP_ORIGIN: "https://app.example",
  CSRF_SECRET: "s".repeat(32),
  INVITATION_SECRET: "i".repeat(32),
};

it.each([
  ["APP_ORIGIN", ""],
  ["APP_ORIGIN", "https://app.example/"],
  ["APP_ORIGIN", "file:///tmp"],
  ["APP_ORIGIN", "https://user:pass@app.example"],
  ["APP_ORIGIN", "not a URL"],
  ["CSRF_SECRET", "short"],
  ["INVITATION_SECRET", ""],
  ["PORT", "0"],
  ["PORT", "65536"],
  ["PORT", "12.5"],
  ["PORT", "invalid"],
  ["TRUSTED_PROXIES", "127.0.0.1/33"],
  ["TRUSTED_PROXIES", "::1/129"],
  ["TRUSTED_PROXIES", "true"],
  ["TRUSTED_PROXIES", "127.0.0.1,"],
])("rejects invalid %s value %j at startup", (name, value) => {
  expect(() => createConfiguration({ ...production, [name]: value })).toThrow(name);
});

it("preserves optional development origin/secrets and accepts explicit IP proxy policies", () => {
  expect(createConfiguration({ NODE_ENV: "development", APP_ORIGIN: "" }).appOrigin).toBe("");
  expect(
    createConfiguration({ TRUSTED_PROXIES: "127.0.0.1, ::1/128, loopback" }).trustedProxies,
  ).toEqual(["127.0.0.1", "::1/128", "loopback"]);
  expect(createConfiguration({ ...production, CSRF_SECRET: "😀".repeat(8) }).csrfSecret).toBe(
    "😀".repeat(8),
  );
});
