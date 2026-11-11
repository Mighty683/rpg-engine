<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { account } from "../../modules/auth/session";
import { useApiServices } from "../api-services";

const { games: api } = useApiServices();

const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const gameId = computed(() => (typeof route.params.gameId === "string" ? route.params.gameId : ""));
const gameLink = computed(() => (gameId.value ? `/games/${gameId.value}` : null));
const game = useQuery({
  queryKey: computed(() => ["accounts", account.value?.id, "games", gameId.value]),
  queryFn: () => api.getGame(gameId.value),
  enabled: computed(() => Boolean(gameId.value)),
});
</script>

<template>
  <nav aria-label="Primary navigation" class="space-y-small">
    <RouterLink
      to="/"
      class="block rounded p-small font-semibold"
      data-testid="nav-games"
      @click="emit('navigate')"
      >Games</RouterLink
    >
    <RouterLink
      v-if="gameLink"
      :to="gameLink"
      class="block rounded p-small text-muted"
      data-testid="nav-game"
      @click="emit('navigate')"
      >{{ game.data.value?.game.name ?? "Game table" }}</RouterLink
    >
  </nav>
</template>
