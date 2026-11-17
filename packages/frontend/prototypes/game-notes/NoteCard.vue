<script setup lang="ts">
import SurfaceCard from "../../src/shared/design-system/base/SurfaceCard.vue";
import type { Entry } from "./types";

defineProps<{ entry: Entry }>();
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
</script>

<template>
  <SurfaceCard compact>
    <div class="space-y-small">
      <header>
        <h3 class="break-words font-semibold note-title">{{ entry.title }}</h3>
        <p class="note-metadata text-muted">
          Created {{ date(entry.createdAt) }} · Updated {{ date(entry.updatedAt) }}
        </p>
      </header>
      <p v-if="entry.content" class="whitespace-pre-wrap break-words">
        {{ entry.content }}
      </p>
      <slot />
    </div>
  </SurfaceCard>
</template>

<style scoped>
h3.note-title {
  font-size: var(--text-label);
}
p.note-metadata {
  font-size: var(--text-meta);
}
</style>
