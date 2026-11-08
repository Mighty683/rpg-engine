<script setup lang="ts">
import { ref, watch } from "vue";
import ConfirmDialog from "./ConfirmDialog.vue";
const props = defineProps<{
  title: string;
  notes?: string;
  editLabel?: string;
  removeLabel?: string;
  removeDescription?: string;
  removeBelow?: boolean;
  locked?: boolean;
  removeTestId?: string;
}>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ remove: [] }>();
const confirming = ref(false);
watch(
  () => props.locked,
  (locked) => {
    if (locked) {
      open.value = false;
      confirming.value = false;
    }
  },
);
function confirmRemove() {
  confirming.value = false;
  emit("remove");
}
</script>

<template>
  <article class="detail-card" :class="{ 'detail-card-compact': removeBelow }">
    <div class="card-row">
      <UPopover
        v-model:open="open"
        :content="{ side: 'top', align: 'start', collisionPadding: 12 }"
        :ui="{ content: 'detail-popover' }"
      >
        <button
          type="button"
          class="card-trigger"
          data-testid="open-entry-details"
          :aria-label="editLabel ?? `Edit ${title}`"
        >
          <span class="card-copy"
            ><span class="card-title"
              ><strong>{{ title }}</strong
              ><slot name="icon" /></span
            ><span v-if="notes" class="card-notes">{{ notes }}</span>
            <slot name="status" />
          </span>
          <span v-if="$slots.trailing" class="card-trailing"><slot name="trailing" /></span>
        </button>
        <template #content>
          <div class="card-editor">
            <div class="editor-title">
              <slot name="title"
                ><strong>{{ title }}</strong></slot
              >
              <UButton color="neutral" variant="outline" class="shrink-0" type="button" aria-label="Close details" @click="open = false">×</UButton>
            </div>
            <slot />
          </div>
        </template>
      </UPopover>
      <UButton
        v-if="!removeBelow && removeLabel"
        color="error"
        variant="outline"
        type="button"
        class="shrink-0"
        :data-testid="removeTestId"
        :aria-label="removeLabel"
        @click="confirming = true"
      >
        ×
      </UButton>
    </div>
    <div v-if="removeBelow && removeLabel" class="card-footer">
      <UButton
        color="error"
        variant="outline"
        type="button"
        :data-testid="removeTestId"
        :aria-label="removeLabel"
        @click="confirming = true"
      >
        Remove
      </UButton>
    </div>
    <ConfirmDialog :open="confirming" :title="`Remove ${title}?`" :description="removeDescription ?? `Remove ${title}?`" confirm-label="Remove" confirm-test-id="confirm-remove" cancel-test-id="cancel-remove" destructive @cancel="confirming = false" @confirm="confirmRemove" />
  </article>
</template>

<style scoped>
.detail-card {
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  min-width: 0;
  padding: var(--spacing-small);
}
.card-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
}
.card-trigger {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-small);
  text-align: left;
}
.card-copy {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}
.card-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
  min-width: 0;
}
.card-copy strong,
.card-notes {
  overflow-wrap: anywhere;
}
.card-notes {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}
.card-trailing {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-small);
  flex: none;
  padding: var(--spacing-small);
  border-left: 1px solid var(--ui-border-accented);
  color: var(--ui-text-muted);
  font-size: 0.875rem;
  white-space: nowrap;
}
.detail-card-compact .card-trigger {
  font-size: 0.875rem;
}
.card-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--ui-border);
  margin-top: var(--spacing-small);
  padding-top: var(--spacing-small);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
}
.card-editor {
  position: relative;
  max-height: min(calc(100dvh - 2rem), var(--reka-popover-content-available-height, 100dvh));
  overflow-y: auto;
  width: min(20rem, 85vw, var(--reka-popover-content-available-width, 100vw));
  padding: var(--spacing-large);
}
.editor-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-small);
  margin-bottom: var(--spacing-medium);
}
</style>
