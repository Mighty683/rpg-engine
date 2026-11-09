import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { account } from "../auth/session";
import { api } from "./api";
const gamesKey = () => ["accounts", account.value?.id, "games"];
export function useGamesQuery() {
  return useQuery({
    queryKey: computed(gamesKey),
    queryFn: api.listGames,
    enabled: false,
    retry: false,
  });
}
export function useSystemsQuery() {
  return useQuery({
    queryKey: ["rpg-systems"],
    queryFn: api.listSystems,
    enabled: false,
    retry: false,
  });
}
export function useGameQuery(gameId: string) {
  return useQuery({
    queryKey: computed(() => [...gamesKey(), gameId]),
    queryFn: () => api.getGame(gameId),
  });
}
const membersKey = (gameId: string) => [...gamesKey(), gameId, "members"];
export function useGameMembersQuery(gameId: string) {
  return useQuery({
    queryKey: computed(() => membersKey(gameId)),
    queryFn: () => api.listGameMembers(gameId),
  });
}
export function useSelectGameCharacterMutation(gameId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      characterId: string | null;
      expectedRevision: number;
      membershipId?: string;
    }) =>
      input.membershipId
        ? api.selectMemberCharacter(
            gameId,
            input.membershipId,
            input.characterId,
            input.expectedRevision,
          )
        : api.selectGameCharacter(gameId, input.characterId, input.expectedRevision),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: membersKey(gameId) }),
        client.invalidateQueries({ queryKey: [...gamesKey(), gameId, "characters"] }),
      ]);
    },
  });
}
export function useCreateGameMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createGame,
    onSuccess: () => client.invalidateQueries({ queryKey: gamesKey() }),
  });
}
