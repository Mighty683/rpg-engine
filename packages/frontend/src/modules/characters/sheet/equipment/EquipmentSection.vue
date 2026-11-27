<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import SheetSection from "../../../../shared/design-system/domain/SheetSection.vue";
import NamedEntries from "../entries/NamedEntries.vue";
import type { NamedEntry } from "../types";
defineProps<{ entries: NamedEntry[]; locked: boolean }>();
</script>

<template>
  <SheetSection
    ><template #heading>{{ tr("ui.equipment") }}</template
    ><NamedEntries :entries="entries" :locked="locked" kind="item" />
    <p class="note">{{ tr("ui.equippedArmorAndShieldsContributeToDefense") }}</p></SheetSection
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
  gap: var(--spacing-tight);
}
</style>
