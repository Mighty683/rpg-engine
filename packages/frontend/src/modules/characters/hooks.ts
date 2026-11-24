import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { account } from "../auth/session";
import { useApiServices } from "../../shared/api-services";
import { partyKey } from "../game-table/hooks";
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
export function useGameCharacterQuery(
  gameId: string,
  characterId: string,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const { characters: api } = useApiServices();
  return useQuery({
    queryKey: computed(() => [...gameCharactersKey(gameId), characterId]),
    queryFn: () => api.getGameCharacter(gameId, characterId),
    enabled: computed(() => toValue(enabled)),
  });
}
export function useSaveGameCharacterMutation(gameId: string, characterId: string) {
  const { characters: api } = useApiServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedRevision: number; changes: Record<string, unknown> }) =>
      api.saveGameCharacter(gameId, characterId, input.expectedRevision, input.changes),
    onSuccess: (saved) => {
      client.setQueryData<typeof saved>([...gameCharactersKey(gameId), characterId], (current) =>
        current && current.character.revision > saved.character.revision ? current : saved,
      );
      return Promise.all([
        client.invalidateQueries({ queryKey: gameCharactersKey(gameId), exact: true }),
        client.invalidateQueries({ queryKey: partyKey(gameId) }),
      ]);
    },
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
