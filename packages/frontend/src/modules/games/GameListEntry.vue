<script setup lang="ts">
import { tr } from "../../shared/i18n";
import InteractiveCard from "../../shared/design-system/base/InteractiveCard.vue";
import type { Game } from "./types";

defineProps<{ game: Game; systemLabel: string }>();
</script>

<template>
  <li data-testid="game-row">
    <InteractiveCard :to="`/games/${game.id}`" data-testid="game-row-link">
      <span class="flex min-w-0 flex-col">
        <span data-testid="game-row-name" class="font-medium">{{ game.name }}</span>
        <span data-testid="game-row-system" class="text-small text-muted"
          >{{ systemLabel }} · {{ tr(`ui.${game.role.toLowerCase()}`) }}</span
        >
      </span>
    </InteractiveCard>
  </li>
</template>
