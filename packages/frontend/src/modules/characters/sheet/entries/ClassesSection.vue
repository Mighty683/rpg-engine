<script setup lang="ts">
import SheetSection from "../SheetSection.vue";
import NamedEntries from "./NamedEntries.vue";
import type { NamedEntry } from "../types";
defineProps<{ entries: NamedEntry[]; locked: boolean }>();
</script>

<template>
  <SheetSection
    ><template #heading>◆ CLASSES</template><template #hint>UP TO 2</template
    ><NamedEntries :entries="entries" :locked="locked" kind="class" :limit="2"
  /></SheetSection>
</template>

<style scoped>
.note {
  font-size: var(--sheet-label-size);
  color: var(--ui-text-muted);
}
.heading-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
