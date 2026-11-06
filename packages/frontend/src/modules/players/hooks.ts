import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "./api";
export function usePlayersQuery(gameId: string) {
  return useQuery({
    queryKey: ["games", gameId, "players"],
    queryFn: () => api.listPlayers(gameId),
  });
}
export function usePlayerQuery(gameId: string, playerId: string) {
  return useQuery({
    queryKey: ["games", gameId, "players", playerId],
    queryFn: () => api.getPlayer(gameId, playerId),
  });
}
export function useCreatePlayerMutation(gameId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => api.createPlayer(gameId, input),
    onSuccess: (result) => {
      client.setQueryData<{ players: (typeof result.player)[] }>(
        ["games", gameId, "players"],
        (current) => ({
          players: [
            ...(current?.players ?? []).filter((player) => player.id !== result.player.id),
            result.player,
          ],
        }),
      );
      void client.invalidateQueries({ queryKey: ["games", gameId, "players"] });
    },
  });
}
