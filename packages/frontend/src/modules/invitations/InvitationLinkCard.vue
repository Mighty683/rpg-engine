<script setup lang="ts">
import { tr } from "../../shared/i18n";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
defineProps<{ title: string; url: string; enabled: boolean; pending?: boolean }>();
defineEmits<{ copy: []; toggle: []; rotate: [] }>();
</script>

<template>
  <li class="space-y-small rounded-panel border border-default p-medium">
    <div class="flex flex-wrap items-center gap-small">
      <strong>{{ title }}</strong>
      <UBadge color="neutral" variant="subtle">{{
        enabled ? tr("ui.enabled") : tr("ui.disabled")
      }}</UBadge>
    </div>
    <LabeledInput :label="tr('ui.invitationLink')" :model-value="url" readonly />
    <div class="flex flex-wrap gap-small">
      <UButton color="neutral" variant="outline" @click="$emit('copy')">{{
        tr("ui.copy")
      }}</UButton>
      <UButton color="neutral" variant="outline" :disabled="pending" @click="$emit('toggle')">{{
        enabled ? tr("ui.disable") : tr("ui.enable")
      }}</UButton>
      <UButton color="neutral" variant="outline" :disabled="pending" @click="$emit('rotate')">{{
        tr("ui.rotateLink")
      }}</UButton>
    </div>
  </li>
</template>
