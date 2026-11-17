<script setup lang="ts">
import LabeledInput from "../../src/shared/design-system/base/LabeledInput.vue";
defineProps<{ title: string; content: string; pending?: boolean }>();
defineEmits<{ title: [value: string]; content: [value: string]; commit: [] }>();
</script>
<template>
  <div class="space-y-medium">
    <LabeledInput
      label="Title"
      :model-value="title"
      :disabled="pending"
      :maxlength="160"
      data-testid="note-title"
      @update:model-value="$emit('title', String($event))"
      @blur="$emit('commit')"
    />
    <LabeledInput
      label="Content"
      multiline
      :rows="6"
      :model-value="content"
      :disabled="pending"
      :maxlength="16000"
      data-testid="note-content"
      @update:model-value="$emit('content', String($event))"
      @blur="$emit('commit')"
    />
  </div>
</template>
