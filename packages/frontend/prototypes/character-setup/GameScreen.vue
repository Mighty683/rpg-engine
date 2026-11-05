<script setup lang="ts">
import { ref } from "vue";
import type { Game, Player } from "./types";
defineProps<{ game: Game; formError: string }>();
const playerName = defineModel<string>("playerName", { required: true });
defineEmits<{ addPlayer: []; openPlayer: [player: Player] }>();
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>

        <div class="flex flex-wrap items-baseline gap-medium"><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">{{ game.name }}</h1><span class="text-muted">{{ game.system }}</span></div>
        <div v-if="game.system !== 'Fabula Ultima'" class="rounded-panel border border-default p-large">Fabula Ultima character setup is available for Fabula Ultima games.</div>
        <section class="space-y-large"><h2 class="text-section font-semibold">Players</h2><p v-if="!game.players.length" class="rounded-panel border border-default bg-muted p-section text-muted">No players yet. Add someone to start creating characters.</p><div v-else class="grid gap-medium md:grid-cols-2"><button v-for="person in game.players" :key="person.id" class="rounded-panel border border-default p-large text-left hover:bg-elevated" @click="$emit('openPlayer', person)"><span class="font-semibold">{{ person.name }}</span><span class="block text-muted">{{ person.characters.find(entry => entry.id === person.activeCharacterId)?.identity.name ? `Active: ${person.characters.find(entry => entry.id === person.activeCharacterId)?.identity.name}` : "No active character" }}</span></button></div><form class="flex flex-wrap items-end gap-medium" @submit.prevent="$emit('addPlayer')"><label class="font-medium">Player name<input v-model="playerName" class="mt-small block rounded-panel border border-default bg-default p-medium" /></label><UButton type="submit">Add player</UButton></form><p v-if="formError" role="alert" class="text-error">{{ formError }}</p></section>

</template>
