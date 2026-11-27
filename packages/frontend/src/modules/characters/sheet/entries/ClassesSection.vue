<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
import SheetSection from "../../../../shared/design-system/domain/SheetSection.vue";
import NamedEntries from "./NamedEntries.vue";
import type { NamedEntry } from "../types";
defineProps<{ entries: NamedEntry[]; locked: boolean; existingOnly?: boolean }>();
</script>

<template>
  <SheetSection
    ><template #heading>◆ {{ existingOnly ? tr("ui.manualClasses") : tr("ui.classes") }}</template
    ><template v-if="!existingOnly" #hint>{{ tr("ui.upTo2") }}</template
    ><NamedEntries
      :existing-only="existingOnly"
      :entries="entries"
      :locked="locked"
      kind="class"
      :limit="2"
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
  gap: var(--spacing-tight);
}
</style>
