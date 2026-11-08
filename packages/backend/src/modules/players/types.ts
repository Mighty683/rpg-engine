import type { createMembershipsService } from "./factory.ts";
import type { Actor } from "../auth/types.ts";
import type { GameAccess } from "../games/types.ts";

export type MembershipsService = ReturnType<typeof createMembershipsService>;

export type GameContext = { actor: Actor; gameId: string; access: GameAccess };
