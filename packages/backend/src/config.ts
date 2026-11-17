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
  for (const [name, value] of Object.entries(config.databaseTimeouts)) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647)
      throw new Error(`Invalid database timeout: ${name}`);
  }
  if (config.agent?.enabled && (!config.agent.apiKey?.trim() || !config.agent.model.trim()))
    throw new Error("Enabled Agent requires MISTRAL_API_KEY and MISTRAL_MODEL");
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
  if (env.AGENT_ENABLED && !["true", "false"].includes(env.AGENT_ENABLED))
    throw new Error("AGENT_ENABLED must be true or false");
  const config: Configuration = {
    agent: {
      enabled: env.AGENT_ENABLED === "true",
      model: env.MISTRAL_MODEL ?? "mistral-small-2603",
      apiKey: env.MISTRAL_API_KEY,
    },
    production,
    development: env.NODE_ENV === "development",
    databaseUrl: env.DATABASE_URL,
    databaseTimeouts: {
      connectionMs: Number(env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
      statementMs: Number(env.DB_STATEMENT_TIMEOUT_MS ?? 10000),
      lockMs: Number(env.DB_LOCK_TIMEOUT_MS ?? 2000),
      idleTransactionMs: Number(env.DB_IDLE_TRANSACTION_TIMEOUT_MS ?? 10000),
    },
    port: Number(env.PORT ?? 3000),
    appOrigin: env.APP_ORIGIN,
    trustedProxies,
    csrfSecret: env.CSRF_SECRET,
    invitationSecret: env.INVITATION_SECRET,
  };
  validateConfiguration(config);
  return config;
}
