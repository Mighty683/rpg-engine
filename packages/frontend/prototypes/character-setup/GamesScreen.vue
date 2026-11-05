<script setup lang="ts">
import { ref } from "vue";
import type { Game } from "./types";
defineProps<{ games: Game[] }>();
const listState = defineModel<string>("listState", { required: true });
defineEmits<{ create: []; open: [game: Game] }>();
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>

        <div class="flex flex-wrap items-end justify-between gap-large"><div><p class="text-muted">YOUR CAMPAIGNS</p><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">Games</h1><p class="mt-small text-muted">Gather your players and bring their stories to life.</p></div><UButton @click="$emit('create')">Create game</UButton></div>
        <p v-if="listState === 'loading'" role="status">Loading games…</p><div v-else-if="listState === 'error'" role="alert"><p>Could not load games.</p><UButton class="mt-small" variant="outline" @click="listState = 'ready'">Retry</UButton></div><p v-else-if="listState === 'empty' || !games.length" class="rounded-panel border border-default p-section text-muted">No games yet. Create your first game.</p>
        <div v-else class="grid gap-large md:grid-cols-2"><button v-for="item in games" :key="item.name" type="button" class="rounded-panel border border-default bg-muted p-section text-left hover:bg-elevated" @click="$emit('open', item)"><span class="text-muted">{{ item.system }}</span><span class="mt-small block text-section font-semibold">{{ item.name }}</span><span class="mt-large block font-medium">Open game →</span></button></div>

</template>
