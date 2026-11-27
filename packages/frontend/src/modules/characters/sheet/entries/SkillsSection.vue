<script setup lang="ts">
import { tr } from "../../../../shared/i18n";
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
        ◆ {{ existingOnly ? tr("ui.manualSkills") : tr("ui.skills") }}
        <InfoTooltip
          v-if="!existingOnly"
          :label="tr('ui.aboutSkills')"
          :text="tr('ui.skillsAreClassAbilitiesTheirRanksAndEffectsAre')"
        /></div></template
    ><NamedEntries :existing-only="existingOnly" :entries="entries" :locked="locked" kind="skill" />
    <p v-if="!existingOnly" class="note">
      {{ tr("ui.manualLevelAdvancementAndSkillEffectsAreNotAutomated") }}
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
