<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { useGameQuery } from "./hooks";

const props = defineProps<{ gameId: string }>();
const game = useGameQuery(props.gameId);
useQueryErrorToast(game, tr("ui.couldNotLoadTheGameNameTheGameTable"));
</script>

<template>
  <ULink
    :to="`/games/${gameId}`"
    class="text-small text-muted underline-offset-4 hover:text-highlighted hover:underline"
    data-testid="character-game-link"
  >
    {{ game.data.value?.game.name ?? tr("ui.gameTable") }}
  </ULink>
</template>
