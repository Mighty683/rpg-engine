import { secureFetch } from "../../shared/secure-fetch.ts";
export type Account = { id: string; username: string };

async function authRequest<T>(path: string, body?: Record<string, string>): Promise<T> {
  const response = await secureFetch(`/api/auth/${path}`, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  if (!response.ok) {
    const error = new Error("Authentication request failed") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  current: () => authRequest<{ account: Account }>("me"),
  login: (username: string, password: string) => authRequest<{ account: Account }>("login", { username, password }),
  register: (username: string, password: string) => authRequest<{ account: Account }>("register", { username, password }),
  logout: () => authRequest<{ ok: true }>("logout", {}),
};
