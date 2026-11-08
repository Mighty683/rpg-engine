let pendingToken: Promise<string> | undefined;

async function csrfToken() {
  if (!pendingToken) {
    pendingToken = fetch("/api/auth/csrf", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to initialize request security");
        const value: { csrfToken: string } = await response.json();
        return value.csrfToken;
      })
      .finally(() => {
        pendingToken = undefined;
      });
  }
  return pendingToken;
}

/** Adds the session-bound CSRF token before every browser write. */
export async function secureFetch(path: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return fetch(path, init);
  const send = async () => {
    const headers = new Headers(init?.headers);
    headers.set("x-csrf-token", await csrfToken());
    return fetch(path, { ...init, headers });
  };
  const response = await send();
  if (response.status !== 403) return response;
  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  return payload?.error?.code === "invalid_csrf" ? send() : response;
}
