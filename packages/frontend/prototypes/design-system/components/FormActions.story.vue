<script setup lang="ts">
import FormActions from "../../../src/shared/design-system/base/FormActions.vue";
function initialState() {
  return { pending: false, blocked: false, destructive: false };
}
</script>
<template>
  <Story title="Design system/Base/Form actions" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <form class="max-w-md" @submit.prevent>
            <FormActions
              :submit-label="state.destructive ? 'Remove item' : 'Save'"
              :pending="state.pending"
              :blocked="state.blocked"
              :destructive="state.destructive"
            />
          </form></div
      ></UApp>
    </template>
    <template #controls="{ state }">
      <HstCheckbox v-model="state.pending" title="Pending" />
      <HstCheckbox v-model="state.blocked" title="Hard blocked" />
      <HstCheckbox v-model="state.destructive" title="Destructive" />
    </template>
  </Story>
</template>
