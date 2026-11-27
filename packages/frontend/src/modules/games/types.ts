import type { ApiSchema } from "@rpg-engine/api-schema";
export type ApiError = { fields?: Record<string, string>; message?: string };

export type System = ApiSchema["System"];

export type Game = ApiSchema["Game"];

export type GameMember = ApiSchema["Member"];

export type GameChangeHint = { type?: string; characterId?: string };
