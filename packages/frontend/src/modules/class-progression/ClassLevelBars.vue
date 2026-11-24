<script setup lang="ts">
import type { PartyCharacter } from "../game-table/types";

defineProps<{ entries: NonNullable<PartyCharacter["classSummary"]>; interactive?: boolean }>();
</script>

<template>
  <span class="class-bars" :class="{ interactive }">
    <span v-if="!entries.length" class="class-row">No classes selected</span>
    <span v-for="(entry, index) in entries" :key="index" class="class-row">
      <span v-if="entry.level !== null" class="segments" aria-hidden="true">
        <span v-for="step in 10" :key="step" :class="{ filled: step <= entry.level }" />
      </span>
      <span class="relative"
        >{{ entry.name }}<template v-if="entry.level !== null"> {{ entry.level }}</template></span
      >
    </span>
  </span>
</template>

<style scoped>
.class-bars {
  display: grid;
  gap: var(--spacing-divider);
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-control);
  text-align: start;
  font-size: var(--table-card-body-size);
  color: var(--ui-text-highlighted);
}
.class-row {
  position: relative;
  padding: var(--table-card-gap) var(--table-card-padding);
  background: var(--ui-bg-muted);
  white-space: normal;
  overflow-wrap: anywhere;
}
.interactive .class-row {
  padding-inline-end: var(--spacing-section);
}
.segments {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: var(--spacing-divider);
  background: var(--ui-border-accented);
}
.segments > span {
  background: var(--ui-bg-muted);
}
.segments > .filled {
  background: var(--class-progress-fill);
}
</style>
