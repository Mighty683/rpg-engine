<script setup lang="ts">
import SurfaceCard from "../../src/shared/design-system/base/SurfaceCard.vue";
import NoteBody from "./NoteBody.vue";
import { visibleNoteText } from "./note-document";
import type { Entry } from "./types";

defineProps<{ entry: Entry; clickable?: boolean }>();
defineEmits<{ open: [] }>();
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
</script>

<template>
  <SurfaceCard
    compact
    :class="{ 'note-clickable': clickable }"
    :data-testid="clickable ? 'open-note-' + entry.id : undefined"
  >
    <div class="space-y-small">
      <header>
        <h3 class="break-words font-semibold note-title">
          <button v-if="clickable" type="button" class="note-open text-left" @click="$emit('open')">
            {{ entry.title }}
          </button>
          <template v-else>{{ entry.title }}</template>
        </h3>
        <p class="note-metadata text-muted">
          Created {{ date(entry.createdAt) }} · Updated {{ date(entry.updatedAt) }}
        </p>
      </header>
      <NoteBody v-if="visibleNoteText(entry.content)" :document="entry.content" class="note-text" />
    </div>
  </SurfaceCard>
</template>

<style scoped>
.note-clickable {
  position: relative;
}
.note-open::after {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-panel);
  cursor: pointer;
  content: "";
}
.note-clickable:is(:hover, :focus-within) {
  border-color: var(--ui-primary);
}
.note-open:focus-visible::after {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
}
h3.note-title {
  font-size: var(--text-body);
}
.note-text {
  font-size: var(--text-label);
}
p.note-metadata {
  font-size: var(--text-meta);
}
</style>
