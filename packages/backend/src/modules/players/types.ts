import type { DatabaseTransaction } from "../../database/types.ts";
import type { Actor } from "../auth/types.ts";
import type { GameAccess } from "../games/types.ts";

type MemberRecord = {
  id: string;
  accountId: string;
  name: string;
  removed: boolean;
  activeCharacterId: string | null;
  revision: number;
};
export interface MembershipsService {
  listMembers(actor: Actor, gameId: string): Promise<MemberRecord[]>;
  selectPlayerCharacter(
    actor: Actor,
    gameId: string,
    expectedRevision: number,
    characterId: string | null,
    targetMembershipId?: string,
  ): Promise<MemberRecord>;
  setMemberRemoved(
    actor: Actor,
    gameId: string,
    membershipId: string,
    removed: boolean,
  ): Promise<MemberRecord>;
}

export type GameContext = { actor: Actor; gameId: string; access: GameAccess };

export type ActiveCharacterInput = { expectedRevision: number; characterId: string | null };

export interface MembershipOwnership {
  find(gameId: string, id: string): Promise<MemberRecord | null>;
  forAccount(gameId: string, accountId: string): Promise<MemberRecord | null>;
  create(gameId: string, accountId: string): Promise<string>;
  clearCharacter(gameId: string, id: string): Promise<void>;
  clearMember(gameId: string, id: string): Promise<void>;
  select(gameId: string, id: string, characterId: string, onlyIfEmpty?: boolean): Promise<void>;
  setRemoved(gameId: string, id: string, removed: boolean): Promise<MemberRecord>;
}
export type MembershipOwnershipFactory = (tx: DatabaseTransaction) => MembershipOwnership;
