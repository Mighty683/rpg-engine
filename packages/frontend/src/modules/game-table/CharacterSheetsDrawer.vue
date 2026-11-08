<script setup lang="ts">
type SheetTab = { label: string; value: string };

withDefaults(defineProps<{ tabs: SheetTab[]; showBookmark?: boolean }>(), {
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
      <UTabs
        v-model="selectedId"
        :items="tabs"
        :ui="{ list: 'max-w-full overflow-x-auto', trigger: 'flex-none', content: 'min-w-0' }"
      >
        <template #default="{ item }">
          <span data-testid="sheet-tab">{{ item.label }}</span>
        </template>
        <template #content="{ item }">
          <slot name="sheet" :character-id="item.value" />
        </template>
      </UTabs>
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
