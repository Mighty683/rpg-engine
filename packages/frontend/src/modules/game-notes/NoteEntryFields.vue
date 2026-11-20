<script setup lang="ts">
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import NoteEditor from "./NoteEditor.vue";
import type { NoteDocument } from "./types";

/** Title and rich-text content fields shared by entry creation and entry detail. */
defineProps<{ title: string; content: NoteDocument; pending?: boolean }>();
defineEmits<{ title: [value: string]; content: [value: NoteDocument]; commit: [] }>();
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
    <NoteEditor
      :model-value="content"
      :disabled="pending"
      @update:model-value="$emit('content', $event)"
      @commit="$emit('commit')"
    />
  </div>
</template>
