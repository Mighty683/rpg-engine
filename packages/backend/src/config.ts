import { isIP } from "node:net";
import type { Configuration } from "./types.ts";

function validProxy(value: string) {
  if (["loopback", "linklocal", "uniquelocal"].includes(value)) return true;
  const [address, prefix, ...extra] = value.split("/");
  const version = isIP(address!);
  if (!version || extra.length) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (version === 4 ? 32 : 128);
}

/** Validate injected settings too, before composing routes or opening a listener. */
export function validateConfiguration(config: Configuration) {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535");
  if (config.trustedProxies.some((value) => !validProxy(value)))
    throw new Error(
      "TRUSTED_PROXIES must contain IP addresses, CIDR ranges, or named proxy ranges",
    );
  if (config.production && !config.appOrigin)
    throw new Error("APP_ORIGIN is required in production");
  if (config.appOrigin) {
    let url: URL;
    try {
      url = new URL(config.appOrigin);
    } catch {
      throw new Error("APP_ORIGIN must be an exact HTTP(S) origin");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== config.appOrigin)
      throw new Error("APP_ORIGIN must be an exact HTTP(S) origin");
  }
  if (!config.production) return;
  for (const [name, value] of [
    ["CSRF_SECRET", config.csrfSecret],
    ["INVITATION_SECRET", config.invitationSecret],
  ]) {
    if (!value || Buffer.byteLength(value) < 32)
      throw new Error(`${name} must contain at least 32 bytes`);
  }
}

/** Immutable runtime settings, captured once when an application is composed. */
export function createConfiguration(env: NodeJS.ProcessEnv = process.env): Configuration {
  const production = env.NODE_ENV === "production";
  const proxySetting = env.TRUSTED_PROXIES?.trim();
  if (production && !proxySetting)
    throw new Error("TRUSTED_PROXIES is required in production; use 'none' for direct access");
  const trustedProxies =
    proxySetting === "none" || !proxySetting
      ? []
      : proxySetting.split(",").map((value) => value.trim());
  const config: Configuration = {
    production,
    development: env.NODE_ENV === "development",
    databaseUrl: env.DATABASE_URL,
    port: Number(env.PORT ?? 3000),
    appOrigin: env.APP_ORIGIN,
    trustedProxies,
    csrfSecret: env.CSRF_SECRET,
    invitationSecret: env.INVITATION_SECRET,
  };
  validateConfiguration(config);
  return config;
}
