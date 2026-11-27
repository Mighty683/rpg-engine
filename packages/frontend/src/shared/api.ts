import { apiFailure } from "./api-error";
import { secureFetch } from "./secure-fetch.ts";
/** Session bootstrap and invitation previews handle unauthorized responses locally. */
export function publicRequest<T>(path: string, init?: RequestInit) {
  return jsonRequest<T>(path, init, false);
}

export function request<T>(path: string, init?: RequestInit) {
  return jsonRequest<T>(path, init, true);
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit | undefined,
  notifySession: boolean,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await secureFetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    if (notifySession && response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw await apiFailure(response, path, init?.method);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
