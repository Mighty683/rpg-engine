import type { GameAccess } from "../games/service.ts";

/** The GM can edit every sheet; a player can edit only their own. */
export function canEditCharacter(access: GameAccess, controllerMembershipId: string | null) {
  return access.role === "GM" || access.membershipId === controllerMembershipId;
}
