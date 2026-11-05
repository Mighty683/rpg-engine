<script setup lang="ts">
import InfoTooltip from "../design-system/InfoTooltip.vue";
import DieIcon from "../design-system/DieIcon.vue";
defineProps<{ label: string; help: string }>();
const value = defineModel<string>({ required: true });
</script>

<template>
<div class="die"><div class="stat-label"><span>{{ label }}</span><InfoTooltip :label="`About ${label}`" :text="help" /></div><div class="die-value"><DieIcon :sides="value" /><select v-model="value" :aria-label="label"><option value="6">d6</option><option value="8">d8</option><option value="10">d10</option></select></div></div>
</template>

<style scoped>
.die { min-width: 0; display: grid; text-align: center; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); padding: var(--sheet-tight) var(--spacing-small); }
.stat-label { display: flex; justify-content: center; align-items: center; gap: 0.25rem; color: var(--ui-text-muted); font-size: var(--sheet-label-size); font-weight: 700; letter-spacing: 0.05em; }
.die-value { display: flex; align-items: center; justify-content: center; min-width: 0; }
.die-value :deep(.die-icon) { width: 1rem; height: 1rem; }
.die-value::after { content: "⌄"; color: var(--ui-text-muted); }
select { appearance: none; width: 100%; min-width: 0; text-align: center; cursor: pointer; color: var(--ui-text-highlighted); font-weight: 700; background: transparent; }
</style>
