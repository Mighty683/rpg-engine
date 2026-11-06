import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "./api";
export function useGamesQuery() {
  return useQuery({ queryKey: ["games"], queryFn: api.listGames, enabled: false, retry: false });
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
  return useQuery({ queryKey: ["games", gameId], queryFn: () => api.getGame(gameId) });
}
export function useCreateGameMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createGame,
    onSuccess: () => client.invalidateQueries({ queryKey: ["games"] }),
  });
}
