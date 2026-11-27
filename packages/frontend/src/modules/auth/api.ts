import { publicRequest } from "../../shared/api";
import type { Account } from "./types";

function authRequest<T>(path: string, body?: Record<string, string>): Promise<T> {
  return publicRequest<T>(
    `/api/auth/${path}`,
    body
      ? {
          method: "POST",
          body: JSON.stringify(body),
        }
      : undefined,
  );
}

export const authApi = {
  current: () => authRequest<{ account: Account }>("me"),
  login: (username: string, password: string) =>
    authRequest<{ account: Account }>("login", { username, password }),
  register: (username: string, password: string) =>
    authRequest<{ account: Account }>("register", { username, password }),
  logout: () => authRequest<{ ok: true }>("logout", {}),
};
