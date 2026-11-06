<script setup lang="ts">
const value = defineModel<string>({ required: true });
</script>

<template>
  <label class="theme-field"
    >✦ THEME<input data-testid="character-theme" v-model="value" placeholder="Hope, justice…"
  /></label>
</template>

<style scoped>
.theme-field {
  display: flex;
  flex-direction: column;
  justify-content: end;
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
input {
  display: block;
  width: 100%;
  min-width: 0;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--sheet-tight) var(--spacing-small);
  font-size: var(--text-body);
  line-height: 1.5rem;
  font-weight: 400;
  letter-spacing: normal;
}
@media (max-width: 640px) {
  .theme-field {
    grid-column: 1 / -1;
  }
}
</style>
