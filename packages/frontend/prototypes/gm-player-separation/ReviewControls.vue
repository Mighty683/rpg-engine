<script setup lang="ts">
import type { Option } from "./model";

defineProps<{ accounts: Option[]; invitations: Option[]; accountId: string }>();
const emit = defineEmits<{ account: [id: string]; invitation: [id: string] }>();
</script>

<template>
  <aside
    aria-label="Gallery controls"
    class="flex flex-wrap items-end gap-medium rounded-panel border border-dashed border-muted p-medium"
  >
    <div class="grow">
      <p class="font-semibold">Gallery controls</p>
      <p class="text-muted">Switch accounts or open a sample link as the selected account.</p>
    </div>
    <UFormField label="Sample account">
      <USelect
        :model-value="accountId"
        :items="accounts"
        value-key="id"
        @update:model-value="emit('account', $event)"
      />
    </UFormField>
    <UFormField label="Open sample invitation">
      <USelect
        model-value=""
        :items="invitations"
        value-key="id"
        placeholder="Choose a link"
        @update:model-value="emit('invitation', $event)"
      />
    </UFormField>
  </aside>
</template>
