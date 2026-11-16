import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useApiServices } from "../../shared/api-services";
import { account } from "../auth/session";
import { toProgressionClass } from "./model";

export const gameClassCatalogKey = (gameId: string) => [
  "accounts",
  account.value?.id,
  "games",
  gameId,
  "class-catalog",
];

export function useGameClassCatalogQuery(
  gameId: string,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const { classCatalog } = useApiServices();
  return useQuery({
    queryKey: computed(() => gameClassCatalogKey(gameId)),
    enabled: computed(() => toValue(enabled)),
    queryFn: async () =>
      (await classCatalog.forContext(gameId, false).load()).game.map(toProgressionClass),
  });
}
