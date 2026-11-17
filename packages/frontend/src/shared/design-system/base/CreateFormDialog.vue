<script setup lang="ts">
import FormActions from "./FormActions.vue";

defineProps<{ title: string; submitLabel: string; submitTestId: string; pending: boolean }>();
const open = defineModel<boolean>("open", { required: true });
defineEmits<{ submit: [] }>();
</script>

<template>
  <UModal v-model:open="open" :title="title" :close="!pending" :dismissible="!pending">
    <template #body>
      <form class="space-y-medium" @submit.prevent="$emit('submit')">
        <slot />
        <FormActions
          :submit-label="submitLabel"
          :submit-test-id="submitTestId"
          :pending="pending"
          @cancel="open = false"
        />
      </form>
    </template>
  </UModal>
</template>
