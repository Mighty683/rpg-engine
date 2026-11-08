export type ApiError = { fields?: Record<string, string>; message?: string };

export type System = { id: string; name: string };

export type Game = {
  id: string;
  name: string;
  system: System;
  createdAt: string;
  role: "GM" | "Player";
};

export type GameMember = {
  id: string;
  accountId: string;
  name: string;
  removed: boolean;
  activeCharacterId: string | null;
  revision: number;
};
