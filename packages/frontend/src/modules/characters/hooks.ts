import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { account } from "../auth/session";
import { useApiServices } from "../../shared/api-services";
const gameCharactersKey = (gameId: string) => [
  "accounts",
  account.value?.id,
  "games",
  gameId,
  "characters",
];
export function useGameCharactersQuery(gameId: string) {
  const { characters: api } = useApiServices();
  return useQuery({
    queryKey: computed(() => gameCharactersKey(gameId)),
    queryFn: () => api.listGameCharacters(gameId),
  });
}
export function useCreateGameCharacterMutation(gameId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => api.createGameCharacter(gameId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: gameCharactersKey(gameId) }),
  });
}
export function useGameCharacterQuery(gameId: string, characterId: string) {
  const { characters: api } = useApiServices();
  return useQuery({
    queryKey: computed(() => [...gameCharactersKey(gameId), characterId]),
    queryFn: () => api.getGameCharacter(gameId, characterId),
  });
}
export function useSaveGameCharacterMutation(gameId: string, characterId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedRevision: number; changes: Record<string, unknown> }) =>
      api.saveGameCharacter(gameId, characterId, input.expectedRevision, input.changes),
    onSuccess: () => client.invalidateQueries({ queryKey: gameCharactersKey(gameId), exact: true }),
  });
}
export function useGameCharacterActiveMutation(gameId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { characterId: string; active: boolean }) =>
      api.setGameCharacterActive(gameId, input.characterId, input.active),
    onSuccess: () => client.invalidateQueries({ queryKey: gameCharactersKey(gameId) }),
  });
}
export function useAssignGameCharacterMutation(gameId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { characterId: string; membershipId: string | null }) =>
      api.assignGameCharacter(gameId, input.characterId, input.membershipId),
    onSuccess: () => client.invalidateQueries({ queryKey: gameCharactersKey(gameId) }),
  });
}
export function useDeleteGameCharacterMutation(gameId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) => api.deleteGameCharacter(gameId, characterId),
    onSuccess: () => client.invalidateQueries({ queryKey: gameCharactersKey(gameId) }),
  });
}
export function useCharactersQuery(gameId: string, playerId: string) {
  const { characters: api } = useApiServices();
  return useQuery({
    queryKey: ["games", gameId, "players", playerId, "characters"],
    queryFn: () => api.listCharacters(gameId, playerId),
  });
}
export function useCreateCharacterMutation(gameId: string, playerId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.createCharacter(gameId, playerId, input),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["games", gameId, "players", playerId, "characters"] }),
  });
}
export function useCharacterQuery(gameId: string, playerId: string, characterId: string) {
  const { characters: api } = useApiServices();
  return useQuery({
    queryKey: ["games", gameId, "players", playerId, "characters", characterId],
    queryFn: () => api.getCharacter(gameId, playerId, characterId),
  });
}
export function useSaveCharacterMutation(gameId: string, playerId: string, characterId: string) {
  const { characters: api } = useApiServices();
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
  const { players: playersApi } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedRevision: number; characterId: string | null }) =>
      playersApi.setActive(gameId, playerId, input.expectedRevision, input.characterId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["games", gameId, "players", playerId] }),
  });
}
