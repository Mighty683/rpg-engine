export type GameInvitation = {
  id: string;
  kind: "game" | "character";
  characterId: string | null;
  enabled: boolean;
  url: string;
};

export type InvitationPreview = {
  kind: "game" | "character";
  gameId: string;
  gameName: string;
  alreadyMember: boolean;
  characterId?: string;
  characterName?: string;
};
