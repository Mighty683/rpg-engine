<script setup lang="ts">
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { useGameQuery } from "./hooks";

const props = defineProps<{ gameId: string }>();
const game = useGameQuery(props.gameId);
useQueryErrorToast(game, "Could not load the game name. The game table link is still available.");
</script>

<template>
  <ULink
    :to="`/games/${gameId}`"
    class="text-small text-muted underline-offset-4 hover:text-highlighted hover:underline"
    data-testid="character-game-link"
  >
    {{ game.data.value?.game.name ?? "Game table" }}
  </ULink>
</template>
