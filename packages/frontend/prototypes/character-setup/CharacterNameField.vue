<script setup lang="ts">
import { ref } from "vue";
const value = defineModel<string>({ required: true });
const heading = ref<HTMLElement>();
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
<div class="name-field min-w-0"><p class="sheet-kicker">FABULA ULTIMA <span> / CHARACTER SHEET</span></p><h1 ref="heading" tabindex="-1" class="sr-only">Character sheet</h1><label class="sheet-name"><span class="sr-only">Character name</span><input v-model="value" placeholder="Character name" /></label></div>
</template>

<style scoped>
.name-field { display: flex; flex-direction: column; justify-content: end; }
.sheet-kicker { color: var(--ui-primary); font-size: var(--sheet-label-size); font-weight: 700; letter-spacing: 0.05em; }
input { display: block; width: 100%; min-width: 0; color: var(--ui-text-highlighted); background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); padding: var(--sheet-tight) var(--spacing-small); font-size: var(--text-body); line-height: 1.5rem; font-weight: 400; letter-spacing: normal; }
input::placeholder { color: var(--ui-text-muted); }
@media (max-width: 640px) { .name-field { grid-column: 1 / -1; } }
</style>
