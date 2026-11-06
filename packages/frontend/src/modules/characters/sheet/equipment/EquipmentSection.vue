<script setup lang="ts">
import SheetSection from "../../../../shared/design-system/SheetSection.vue";
import NamedEntries from "../entries/NamedEntries.vue";
import type { NamedEntry } from "../types";
defineProps<{ entries: NamedEntry[]; locked: boolean }>();
</script>

<template>
  <SheetSection
    ><template #heading>◇ EQUIPMENT</template
    ><NamedEntries :entries="entries" :locked="locked" kind="item" />
    <p class="note">
      Equipped armor and shield modify defense. Other effects are not calculated.
    </p></SheetSection
  >
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
