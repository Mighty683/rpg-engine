<script setup lang="ts">
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
defineProps<{ title: string; url: string; enabled: boolean; pending?: boolean }>();
defineEmits<{ copy: []; toggle: []; rotate: [] }>();
</script>

<template>
  <li class="space-y-small rounded-panel border border-default p-medium">
    <div class="flex flex-wrap items-center gap-small">
      <strong>{{ title }}</strong>
      <UBadge color="neutral" variant="subtle">{{ enabled ? "Enabled" : "Disabled" }}</UBadge>
    </div>
    <LabeledInput label="Invitation link" :model-value="url" readonly />
    <div class="flex flex-wrap gap-small">
      <UButton color="neutral" variant="outline" @click="$emit('copy')">Copy</UButton>
      <UButton color="neutral" variant="outline" :disabled="pending" @click="$emit('toggle')">{{
        enabled ? "Disable" : "Enable"
      }}</UButton>
      <UButton color="neutral" variant="outline" :disabled="pending" @click="$emit('rotate')"
        >Rotate link</UButton
      >
    </div>
  </li>
</template>
