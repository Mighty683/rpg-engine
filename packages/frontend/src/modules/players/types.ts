export type Player = {
  id: string;
  gameId: string;
  name: string;
  createdAt: string;
  revision: number;
  activeCharacter: { id: string; name: string } | null;
};
