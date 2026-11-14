<script setup lang="ts">
import ConfirmDialog from "../../../src/shared/design-system/base/ConfirmDialog.vue";
import { ref } from "vue";
const open = ref(false);
function initialState() {
  return { destructive: true, pending: false };
}
</script>
<template>
  <Story title="Design system/Base/Confirmation dialog" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <UButton @click="open = true">Open dialog</UButton
          ><ConfirmDialog
            :open="open"
            title="Confirm action"
            :destructive="state.destructive"
            :pending="state.pending"
            confirm-label="Confirm"
            @cancel="open = false"
            @confirm="open = false"
            ><p>This action applies to the selected item.</p></ConfirmDialog
          >
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.destructive" title="Destructive" /><HstCheckbox
        v-model="state.pending"
        title="Pending"
    /></template>
  </Story>
</template>
