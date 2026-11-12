import type { Response } from "express";
import type { createGameEvents } from "./streams.ts";

export type GameEvent =
  | { type: "roster" }
  | { type: "sheet"; characterId: string }
  | { type: "throws" }
  | { type: "npcs" };

export type Subscription = {
  gameId: string;
  accountId: string;
  sessionId: string;
  response: Response;
  active: boolean;
  close: () => void;
};

export type GameEvents = ReturnType<typeof createGameEvents>;
