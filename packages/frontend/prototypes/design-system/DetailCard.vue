<script setup lang="ts">
import { ref, watch } from "vue";
import ZenitIcon from "./ZenitIcon.vue";
import WeaponIcon from "./WeaponIcon.vue";
import EquipmentIcon from "./EquipmentIcon.vue";

const props = defineProps<{ title: string; notes?: string; price?: number | null; removeLabel?: string; removeBelow?: boolean; weapon?: boolean; badge?: string; equipped?: boolean; locked?: boolean; removeTestId?: string }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ remove: [] }>();
const confirming = ref(false);
watch(() => props.locked, (locked) => { if (locked) { open.value = false; confirming.value = false; } });
function confirmRemove() { confirming.value = false; emit("remove"); }
</script>

<template>
  <article class="detail-card" :class="{ 'detail-card-compact': removeBelow }">
    <div class="card-row">
      <UPopover v-model:open="open" :content="{ side: 'top', align: 'start', collisionPadding: 12 }" :ui="{ content: 'detail-popover' }">
        <button type="button" class="card-trigger" :aria-label="weapon ? `Edit ${title}, weapon` : `Edit ${title}`">
          <span class="card-copy"><span class="card-title"><strong>{{ title }}</strong><WeaponIcon v-if="weapon" /></span><span v-if="notes" class="card-notes">{{ notes }}</span><span v-if="equipped !== undefined" class="card-badge" :class="{ active: equipped }"><EquipmentIcon kind="equipped" />{{ equipped ? "Equipped" : "Not equipped" }}</span><span v-else-if="badge" class="card-badge active">{{ badge }}</span></span>
          <span v-if="price !== null && price !== undefined" class="card-price"><ZenitIcon /> {{ price }} <span class="sr-only">zenits</span></span>
        </button>
        <template #content>
          <div class="card-editor"><div class="editor-title"><slot name="title"><strong>{{ title }}</strong></slot></div><slot /><button class="editor-close" type="button" aria-label="Close details" @click="open = false">×</button></div>
        </template>
      </UPopover>
      <button v-if="!removeBelow && removeLabel" type="button" class="card-remove" :data-testid="removeTestId" :aria-label="removeLabel" @click="confirming = true">×</button>
    </div>
    <div v-if="removeBelow && removeLabel" class="card-footer"><button type="button" :data-testid="removeTestId" :aria-label="removeLabel" @click="confirming = true">Remove</button></div>
    <UModal v-model:open="confirming" :title="`Remove ${title}?`" :description="`Remove ${title} from this character?`">
      <template #body><div class="flex gap-small"><UButton data-testid="cancel-remove" color="neutral" variant="outline" @click="confirming = false">Cancel</UButton><UButton data-testid="confirm-remove" color="error" @click="confirmRemove">Remove</UButton></div></template>
    </UModal>
  </article>
</template>

<style scoped>
.detail-card { border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg-muted); min-width: 0; padding: var(--spacing-small); }
.card-row { display: flex; align-items: center; gap: var(--spacing-small); }
.card-trigger { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: space-between; gap: var(--spacing-small); text-align: left; }
.card-copy { display: grid; min-width: 0; line-height: 1.25; }
.card-title { display: flex; align-items: center; gap: var(--spacing-small); min-width: 0; }
.card-copy strong, .card-notes { overflow-wrap: anywhere; }
.card-notes { color: var(--ui-text-muted); font-size: 0.875rem; }
.card-badge { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--ui-text-muted); font-size: 0.75rem; }
.card-badge.active { color: var(--ui-primary); }
.card-price { display: inline-flex; align-items: center; gap: var(--spacing-small); flex: none; padding: var(--spacing-small); border-left: 1px solid var(--ui-border-accented); color: var(--ui-text-muted); font-size: 0.875rem; white-space: nowrap; }
.card-remove { flex: none; padding: var(--spacing-small); }
.detail-card-compact .card-trigger { font-size: 0.875rem; }
.card-footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--ui-border); margin-top: var(--spacing-small); padding-top: var(--spacing-small); color: var(--ui-text-muted); font-size: 0.75rem; }
.card-editor { position: relative; max-height: calc(100dvh - 2rem); overflow-y: auto; width: min(20rem, 85vw); padding: var(--spacing-large); }
.editor-title { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-small); margin-bottom: var(--spacing-medium); }
.editor-close { position: absolute; top: var(--spacing-small); right: var(--spacing-small); padding: var(--spacing-small); }
</style>
