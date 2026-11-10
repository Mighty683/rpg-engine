import type { Ref } from "vue";
import type { authApi } from "../modules/auth/api";
import type { api as charactersApi } from "../modules/characters/api";
import type { api as gameTableApi } from "../modules/game-table/api";
import type { api as gamesApi } from "../modules/games/api";
import type { invitationApi } from "../modules/invitations/api";
import type { api as playersApi } from "../modules/players/api";

/** Replaceable backend boundary; only composition roots import concrete implementations. */
export interface ApiServices {
  auth: typeof authApi;
  characters: typeof charactersApi;
  gameTable: typeof gameTableApi;
  games: typeof gamesApi;
  invitations: typeof invitationApi;
  players: typeof playersApi;
}

export type SaveError = Error & {
  code?: string;
  status?: number;
};

export type OptimisticSaveOptions<TSnapshot, TInput> = {
  initial?: Ref<TSnapshot | null>;
  apply: (snapshot: TSnapshot, input: TInput) => TSnapshot;
  save: (snapshot: TSnapshot, input: TInput) => Promise<TSnapshot>;
  refresh: () => Promise<TSnapshot>;
  merge?: (previous: TInput, next: TInput) => TInput;
  isKnownRejection?: (error: SaveError) => boolean;
};

export type TagColor = "primary" | "warning" | "error" | "info" | "success" | "neutral";

export type Tag = { name: string; color: TagColor };
