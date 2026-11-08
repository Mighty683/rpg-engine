import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { secureFetch } from "./secure-fetch.ts";

afterEach(() => vi.unstubAllGlobals());

describe("secure fetch", () => {
  it("adds a session token to writes and retries only a rejected CSRF check", async () => {
    let tokenRequests = 0;
    let writes = 0;
    const observedTokens: (string | null)[] = [];
    const mock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/auth/csrf")
        return Response.json({ csrfToken: `token-${++tokenRequests}` });
      writes++;
      observedTokens.push(new Headers(init?.headers).get("x-csrf-token"));
      return writes === 1
        ? Response.json({ error: { code: "invalid_csrf" } }, { status: 403 })
        : Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", mock);
    const response = await secureFetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(observedTokens).toEqual(["token-1", "token-2"]);
    expect(tokenRequests).toBe(2);
  });

  it("does not request a CSRF token for reads or retry unrelated forbidden responses", async () => {
    const mock = vi.fn(async (input: string) =>
      input === "/api/auth/csrf"
        ? Response.json({ csrfToken: "token" })
        : Response.json({ error: { code: "forbidden" } }, { status: 403 }),
    );
    vi.stubGlobal("fetch", mock);
    expect((await secureFetch("/api/games")).status).toBe(403);
    expect(mock).toHaveBeenCalledTimes(1);
    expect((await secureFetch("/api/games", { method: "DELETE" })).status).toBe(403);
    expect(mock).toHaveBeenCalledTimes(3);
  });
});
