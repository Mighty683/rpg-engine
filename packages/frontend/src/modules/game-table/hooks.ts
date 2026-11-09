import type { CreateThrowInput, ThrowRecord } from "./types";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { account } from "../auth/session";
import { api } from "./api";

import { hasWindowGap, historyPageSize, mergeThrowPages, olderCursor } from "./history.ts";

const gameKey = (gameId: string) => ["accounts", account.value?.id, "games", gameId];
export const partyKey = (gameId: string) => [...gameKey(gameId), "party"];
export const throwsKey = (gameId: string) => [...gameKey(gameId), "throws"];

export function useGamePartyQuery(gameId: string) {
  return useQuery({
    queryKey: computed(() => partyKey(gameId)),
    queryFn: () => api.getGameParty(gameId),
  });
}

/**
 * Owns the loaded throw-history window: the newest page initially, older pages by an
 * exclusive sequence cursor, and refetches on invalidation hints. The HTTP list is
 * authoritative; the in-process event stream only triggers refetches.
 */
export function useThrowHistory(gameId: string) {
  const client = useQueryClient();
  const pages = ref<(number | null)[]>([null]);
  const queries = useQueries({
    queries: computed(() =>
      pages.value.map((before) => ({
        queryKey: [...throwsKey(gameId), before ?? "newest"],
        queryFn: () =>
          api.listGameThrows(gameId, { before: before ?? undefined, limit: historyPageSize }),
      })),
    ),
  });
  const pageData = computed(() =>
    queries.value.map((query) => (query.data?.throws ?? []) as ThrowRecord[]),
  );
  const throws = computed(() => mergeThrowPages(pageData.value));
  const newestPage = computed(
    () => queries.value.find((_, index) => pages.value[index] === null)?.data?.throws ?? [],
  );
  const isLoading = computed(() => queries.value.some((query) => query.isLoading));
  const isError = computed(() => queries.value.some((query) => query.isError));
  const oldestPageFull = computed(() => {
    let oldest = 0;
    pages.value.forEach((cursor, index) => {
      if (cursor !== null && (pages.value[oldest] === null || cursor < pages.value[oldest]!))
        oldest = index;
    });
    return (queries.value[oldest]?.data?.throws.length ?? 0) === historyPageSize;
  });
  const hasOlder = computed(() => oldestPageFull.value && throws.value.length > 0);

  watch(throws, (value) => {
    if (queries.value.some((query) => query.isFetching)) return;
    if (hasWindowGap(value, newestPage.value) && pages.value.length > 1) pages.value = [null];
  });

  function loadOlder() {
    const cursor = olderCursor(throws.value);
    if (cursor !== null && !pages.value.includes(cursor)) pages.value = [...pages.value, cursor];
  }

  function refresh() {
    if (!pages.value.includes(null)) pages.value = [null, ...pages.value];
    void client.invalidateQueries({ queryKey: throwsKey(gameId) });
  }

  return { throws, pages, isLoading, isError, hasOlder, loadOlder, refresh, queries };
}

export function useCreateThrowMutation(gameId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThrowInput) => api.createGameThrow(gameId, input),
    onSettled: () => client.invalidateQueries({ queryKey: throwsKey(gameId) }),
  });
}

export function useRemoveThrowMutation(gameId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (throwId: string) => api.deleteGameThrow(gameId, throwId),
    onSettled: () => client.invalidateQueries({ queryKey: throwsKey(gameId) }),
  });
}
