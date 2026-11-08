import { secureFetch } from "./secure-fetch.ts";
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await secureFetch(path, {
    headers,
    ...init,
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("session-expired"));
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const error = new Error(`Request failed (${response.status}`) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
