import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "./api";
export function useCharactersQuery(gameId: string, playerId: string) {
  return useQuery({
    queryKey: ["games", gameId, "players", playerId, "characters"],
    queryFn: () => api.listCharacters(gameId, playerId),
  });
}
export function useCreateCharacterMutation(gameId: string, playerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.createCharacter(gameId, playerId, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["games", gameId, "players", playerId, "characters"] }),
  });
}
export function useCharacterQuery(gameId: string, playerId: string, characterId: string) {
  return useQuery({
    queryKey: ["games", gameId, "players", playerId, "characters", characterId],
    queryFn: () => api.getCharacter(gameId, playerId, characterId),
  });
}
export function useSaveCharacterMutation(gameId: string, playerId: string, characterId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedRevision: number; changes: Record<string, unknown> }) =>
      api.saveCharacter(gameId, playerId, characterId, input.expectedRevision, input.changes),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ["games", gameId, "players", playerId, "characters"],
        exact: true,
      }),
  });
}
export function useActiveCharacterMutation(gameId: string, playerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedRevision: number; characterId: string | null }) =>
      api.setActive(gameId, playerId, input.expectedRevision, input.characterId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["games", gameId, "players", playerId] }),
  });
}
