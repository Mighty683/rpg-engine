<script setup lang="ts">
import InfoTooltip from "../design-system/InfoTooltip.vue";
defineProps<{ label: string; help: string; calculated: number; contributions: { name: string; value: number; modifier?: boolean }[] }>();
const value = defineModel<number | null>({ required: true });
function update(event: Event) { const number = (event.target as HTMLInputElement).valueAsNumber; value.value = Number.isNaN(number) ? null : number; }
</script>

<template>
<div class="defense-stat" :data-testid="`defense-card-${label}`"><div class="stat-label"><span>{{ label }}</span><InfoTooltip :label="`About ${label}`" :text="help" /></div><input type="number" :data-testid="`defense-${label}`" :aria-label="label" :value="value ?? calculated" @input="update" /><ul class="defense-calculation" :aria-label="`${label} calculated contributions`"><li v-for="(contribution, index) in contributions" :key="index"><span>{{ contribution.name }}</span><span>{{ contribution.modifier && contribution.value > 0 ? "+" : "" }}{{ contribution.value }}</span></li></ul><span v-if="value !== null" class="override-label">Overridden</span><button v-if="value !== null" :data-testid="`restore-${label}`" type="button" @click="value = null">Use calculated</button></div>
</template>

<style scoped>
.defense-stat { min-width: 0; display: grid; text-align: center; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); padding: var(--sheet-tight) var(--spacing-small); }
.stat-label { display: flex; justify-content: center; align-items: center; gap: 0.25rem; color: var(--ui-text-muted); font-size: var(--sheet-label-size); font-weight: 700; letter-spacing: 0.05em; }
input { width: 4ch; min-width: 0; justify-self: center; appearance: textfield; text-align: center; background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text-highlighted); font-weight: 700; }
input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.defense-calculation { width: 100%; margin-top: var(--spacing-small); border-top: 1px solid var(--ui-border-accented); padding-top: var(--sheet-tight); }
.defense-calculation li { display: flex; justify-content: space-between; align-items: baseline; gap: 0.25rem; text-align: left; }
.defense-calculation span, .override-label { color: var(--ui-text-muted); font-size: var(--sheet-meta-size); font-weight: 400; letter-spacing: normal; line-height: 1.35; overflow-wrap: anywhere; }
.defense-calculation li span:last-child { flex: none; color: var(--ui-text); font-variant-numeric: tabular-nums; }
button { font-size: var(--sheet-meta-size); color: var(--ui-primary); }
</style>
