<script setup lang="ts">
import type { GameSummary } from "./model";

defineProps<{ games: GameSummary[] }>();
const emit = defineEmits<{ open: [id: string]; create: [] }>();
</script>

<template>
  <section class="space-y-section">
    <div class="flex flex-wrap items-center justify-between gap-medium">
      <h1 tabindex="-1" class="text-heading font-semibold">My games</h1>
      <UButton @click="emit('create')">Create game</UButton>
    </div>
    <p v-if="!games.length" class="text-muted">Create a game or open an invitation from a GM.</p>
    <ul v-else class="grid gap-medium sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="game in games" :key="game.id">
        <button
          type="button"
          class="w-full cursor-pointer rounded-panel border border-muted bg-elevated p-large text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          @click="emit('open', game.id)"
        >
          <span class="flex flex-wrap items-center justify-between gap-small">
            <span class="font-semibold">{{ game.name }}</span>
            <UBadge color="neutral" variant="subtle">{{ game.role }}</UBadge>
          </span>
          <span class="text-muted">{{ game.system }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
