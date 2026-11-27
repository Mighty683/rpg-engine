<script setup lang="ts">
import { tr } from "../../shared/i18n";
import CharacterSheetSkeleton from "../characters/sheet/CharacterSheetSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import CharacterSheetTabs from "./CharacterSheetTabs.vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";

withDefaults(
  defineProps<{
    tabs: { label: string; value: string }[];
    showBookmark?: boolean;
    modal?: boolean;
    loading?: boolean;
    failed?: boolean;
  }>(),
  { showBookmark: true, modal: true },
);
defineEmits<{ retry: [] }>();
defineSlots<{ sheet(props: { characterId: string }): unknown }>();

const open = defineModel<boolean>("open", { required: true });
const selectedId = defineModel<string>("selectedId", { required: true });
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="tr('ui.characterSheets')"
    :modal="modal"
    :overlay="modal"
    :dismissible="modal"
    :ui="{ content: 'w-full sm:max-w-4xl' }"
  >
    <UButton
      v-if="showBookmark && !open"
      class="sheet-bookmark"
      color="primary"
      data-testid="open-character-sheets"
      @click="open = true"
      >{{ tr("ui.characterSheets") }}</UButton
    >
    <template #body>
      <UButton
        class="sheet-bookmark sheet-bookmark-close"
        color="primary"
        data-testid="close-character-sheets"
        :aria-label="tr('ui.closeCharacterSheets')"
        @click="open = false"
        >{{ tr("ui.characterSheets") }}</UButton
      >
      <SkeletonRegion
        v-if="loading && !tabs.length"
        :label="tr('ui.loadingCharacters')"
        class="space-y-small"
      >
        <SkeletonBlock class="h-9 w-1/3" />
        <CharacterSheetSkeleton />
      </SkeletonRegion>
      <ContentState v-else-if="failed && !tabs.length" kind="error" @retry="$emit('retry')">
        {{ tr("ui.couldNotLoadCharacters") }}
      </ContentState>
      <ContentState v-else-if="!tabs.length" kind="empty">{{
        tr("ui.noCharacterSheetsYet")
      }}</ContentState>
      <CharacterSheetTabs v-else v-model:selected-id="selectedId" :tabs="tabs">
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
  top: 30%;
  z-index: 20;
  writing-mode: vertical-rl;
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
  padding: var(--spacing-medium) var(--spacing-small);
}
.sheet-bookmark-close {
  z-index: 60;
}
</style>
