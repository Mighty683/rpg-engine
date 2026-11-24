<script setup lang="ts">
import SheetSection from "../../../../shared/design-system/domain/SheetSection.vue";
import NamedEntries from "./NamedEntries.vue";
import InfoTooltip from "../../../../shared/design-system/base/InfoTooltip.vue";
import type { NamedEntry } from "../types";
defineProps<{ entries: NamedEntry[]; locked: boolean; existingOnly?: boolean }>();
</script>

<template>
  <SheetSection
    ><template #heading
      ><div class="heading-label">
        ◆ {{ existingOnly ? "MANUAL SKILLS" : "SKILLS" }}
        <InfoTooltip
          v-if="!existingOnly"
          label="About skills"
          text="Skills are class abilities. Their ranks and effects are not automated here."
        /></div></template
    ><NamedEntries :existing-only="existingOnly" :entries="entries" :locked="locked" kind="skill" />
    <p v-if="!existingOnly" class="note">
      Manual level; advancement and skill effects are not automated.
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
  gap: var(--spacing-tight);
}
</style>
