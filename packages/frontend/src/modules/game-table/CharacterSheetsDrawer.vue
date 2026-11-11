<script setup lang="ts">
import CharacterSheetTabs from "./CharacterSheetTabs.vue";

withDefaults(defineProps<{ tabs: { label: string; value: string }[]; showBookmark?: boolean }>(), {
  showBookmark: true,
});
defineSlots<{ sheet(props: { characterId: string }): unknown }>();

const open = defineModel<boolean>("open", { required: true });
const selectedId = defineModel<string>("selectedId", { required: true });
</script>

<template>
  <USlideover v-model:open="open" title="Character sheets" :ui="{ content: 'w-full sm:max-w-4xl' }">
    <UButton
      v-show="showBookmark && !open"
      class="sheet-bookmark"
      color="primary"
      data-testid="open-character-sheets"
      @click="open = true"
      >Character sheets</UButton
    >
    <template #body>
      <UButton
        class="sheet-bookmark sheet-bookmark-close"
        color="primary"
        data-testid="close-character-sheets"
        aria-label="Close character sheets"
        @click="open = false"
        >Character sheets</UButton
      >
      <CharacterSheetTabs v-model:selected-id="selectedId" :tabs="tabs">
        <template #sheet="{ characterId }">
          <slot name="sheet" :character-id="characterId" />
        </template>
      </CharacterSheetTabs>
    </template>
  </USlideover>
</template>

<style scoped>
.sheet-bookmark {
  position: fixed;
  right: 0;
  top: 45%;
  z-index: 20;
  writing-mode: vertical-rl;
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
  padding: var(--spacing-medium) var(--spacing-small);
}
.sheet-bookmark-close {
  z-index: 60;
}
</style>
