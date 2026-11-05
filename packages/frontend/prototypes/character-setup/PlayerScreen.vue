<script setup lang="ts">
import { ref } from "vue";
import type { Game, Player, Character } from "./types";
defineProps<{ game: Game; player: Player }>();
defineEmits<{ createCharacter: []; openCharacter: [character: Character]; setActive: [character: Character] }>();
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>

        <div class="flex flex-wrap items-end justify-between gap-large"><div><p class="text-muted">{{ game.name }} / Player</p><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">{{ player.name }}</h1><p class="mt-small text-muted">Characters can be revisited at any time.</p></div><UButton v-if="game.system === 'Fabula Ultima'" @click="$emit('createCharacter')">Create character</UButton></div><div v-if="!player.characters.length" class="rounded-panel border border-default bg-muted p-section text-muted">No characters yet. Create the first character for {{ player.name }}.</div><div v-else class="grid gap-medium"><div v-for="entry in player.characters" :key="entry.id" class="flex flex-wrap items-center justify-between gap-medium rounded-panel border border-default p-large"><button class="text-left" @click="$emit('openCharacter', entry)"><span class="font-semibold">{{ entry.identity.name || 'Unnamed character' }}</span><span class="block text-muted">View character →</span></button><span v-if="player.activeCharacterId === entry.id" class="text-muted">Active</span><UButton v-else size="sm" variant="outline" @click="$emit('setActive', entry)">Set active</UButton></div></div>

</template>
