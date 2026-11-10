<script setup lang="ts">
import { computed, ref } from "vue";
import type { Tag, TagColor } from "./tags";
import { tagColors } from "./tags";

const props = defineProps<{
  tags: Tag[];
  savedTags: readonly Tag[];
}>();
const emit = defineEmits<{ change: [tags: Tag[]] }>();

const tagInput = ref("");
const color = ref<TagColor>("primary");

const suggestions = computed(() =>
  props.savedTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(tagInput.value.toLowerCase()) &&
      !props.tags.some((t) => t.name === tag.name),
  ),
);

function addTag(name: string, tagColor: TagColor = color.value) {
  const value = name.trim();
  if (!value) return;
  if (props.tags.some((t) => t.name === value)) return;
  const existing = props.savedTags.find((t) => t.name === value);
  emit("change", [...props.tags, { name: value, color: existing?.color ?? tagColor }]);
  tagInput.value = "";
}

function removeTag(name: string) {
  emit(
    "change",
    props.tags.filter((t) => t.name !== name),
  );
}
</script>

<template>
  <div class="tag-editor" data-testid="tag-editor">
    <ul v-if="tags.length" class="tag-list">
      <li v-for="tag in tags" :key="tag.name">
        <UBadge :color="tag.color" variant="outline" size="sm" class="tag-badge">
          {{ tag.name }}
          <button type="button" :aria-label="`Remove tag ${tag.name}`" @click="removeTag(tag.name)">
            ×
          </button>
        </UBadge>
      </li>
    </ul>
    <p v-else class="text-label text-muted">No tags yet.</p>
    <form class="tag-add" @submit.prevent="addTag(tagInput)">
      <label class="tag-color"
        ><span class="sr-only">Tag color</span
        ><select v-model="color" data-testid="tag-color" aria-label="Tag color">
          <option v-for="option in tagColors" :key="option" :value="option">{{ option }}</option>
        </select></label
      >
      <input
        v-model="tagInput"
        placeholder="Add tag…"
        data-testid="tag-input"
        aria-label="Add tag"
      />
      <UButton type="submit" size="sm" color="neutral" variant="outline" data-testid="add-tag"
        >Add</UButton
      >
    </form>
    <ul v-if="tagInput && suggestions.length" class="tag-suggestions" data-testid="tag-suggestions">
      <li v-for="tag in suggestions" :key="tag.name">
        <button type="button" @click="addTag(tag.name, tag.color)">
          <UBadge :color="tag.color" variant="subtle" size="sm">{{ tag.name }}</UBadge>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tag-editor {
  display: grid;
  gap: var(--spacing-small);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-tight);
  margin-top: var(--sheet-tight, var(--spacing-tight));
}
.tag-badge button {
  margin-left: 0.125rem;
}
.tag-add {
  display: flex;
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.tag-add input,
.tag-add select {
  display: block;
  min-width: 0;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  color: var(--ui-text);
  padding: var(--spacing-small);
  font-size: 0.875rem;
}
.tag-add input {
  flex: 1;
}
.tag-color select {
  width: 7rem;
  color: var(--ui-text-highlighted);
  font-weight: 700;
  text-transform: capitalize;
}
.tag-suggestions {
  display: grid;
  gap: var(--spacing-tight);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg);
  padding: var(--spacing-tight);
}
.tag-suggestions button {
  display: block;
  width: 100%;
  border-radius: var(--radius-panel);
  padding: var(--spacing-tight) var(--spacing-small);
  text-align: left;
}
.tag-suggestions button:hover {
  background: var(--ui-bg-muted);
}
</style>
