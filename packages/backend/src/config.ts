/** Immutable runtime settings, captured once when an application is composed. */
export function createConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  const proxySetting = env.TRUSTED_PROXIES?.trim();
  if (production && !proxySetting) {
    throw new Error("TRUSTED_PROXIES is required in production; use 'none' for direct access");
  }
  return {
    production,
    development: env.NODE_ENV === "development",
    databaseUrl: env.DATABASE_URL,
    port: Number(env.PORT ?? 3000),
    appOrigin: env.APP_ORIGIN,
    trustedProxies:
      proxySetting === "none"
        ? []
        : (proxySetting
            ?.split(",")
            .map((value) => value.trim())
            .filter(Boolean) ?? []),
    csrfSecret: env.CSRF_SECRET,
    invitationSecret: env.INVITATION_SECRET,
  };
}
