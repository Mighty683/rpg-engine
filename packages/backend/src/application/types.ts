import type { GameClassStore } from "../modules/class-catalog/types.ts";
import type { Database, DatabaseTransaction } from "../database/types.ts";
import type {
  CharacterOwnership,
  CharactersService,
  ClassProgressionStore,
} from "../modules/characters/types.ts";
import type { MembershipOwnership, MembershipsService } from "../modules/players/types.ts";
import type { InvitationOwnership, InvitationsService } from "../modules/invitations/types.ts";
import type { GameAccessFactory } from "../modules/games/types.ts";
import type { GameEvents, GameEventPublisher } from "../modules/events/types.ts";
export type OwnershipStores = {
  characters: CharacterOwnership;
  memberships: MembershipOwnership;
  invitations: InvitationOwnership;
};
export type OwnershipStoreFactory = (tx: DatabaseTransaction) => OwnershipStores;
export type OwnershipDependencies = {
  database: Database;
  events: GameEvents;
  gameAccessFor: GameAccessFactory;
  storesFor: OwnershipStoreFactory;
};
export type OwnershipWorkflows = Pick<CharactersService, "assignCharacter"> &
  Pick<MembershipsService, "setMemberRemoved"> &
  Pick<InvitationsService, "acceptInvitation">;

export type GameClassEditDependencies = {
  database: Database;
  events: GameEventPublisher;
  gameAccessFor: GameAccessFactory;
  classesFor: (tx: DatabaseTransaction) => GameClassStore;
  progressionFor: (tx: DatabaseTransaction) => ClassProgressionStore;
};
