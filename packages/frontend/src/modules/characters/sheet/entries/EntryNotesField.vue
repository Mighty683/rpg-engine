<script setup lang="ts">
defineProps<{ name: string }>();
const notes = defineModel<string>({ required: true });
</script>
<template>
  <label
    >Notes <span class="text-muted">(optional)</span
    ><input v-model="notes" :aria-label="`Notes for ${name}`" placeholder="Add notes"
  /></label>
</template>
<style scoped>
label {
  display: block;
  min-width: 0;
  font-size: 0.75rem;
  color: var(--ui-text-muted);
}
input {
  display: block;
  width: 100%;
  min-width: 0;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  color: var(--ui-text);
  padding: var(--spacing-small);
  font-size: 0.875rem;
}
</style>
