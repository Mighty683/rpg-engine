<script setup lang="ts">
import { watch } from "vue";
const props = defineProps<{ tabs: { label: string; value: string }[] }>();
defineSlots<{ sheet(props: { characterId: string }): unknown }>();
const selectedId = defineModel<string>("selectedId", { required: true });
watch(
  () => props.tabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.value === selectedId.value))
      selectedId.value = tabs[0]?.value ?? "";
  },
  { immediate: true },
);
</script>

<template>
  <UTabs
    v-model="selectedId"
    :items="tabs"
    :ui="{ list: 'max-w-full overflow-x-auto', trigger: 'flex-none', content: 'min-w-0' }"
  >
    <template #default="{ item }">
      <span data-testid="sheet-tab" :data-character-id="item.value">{{ item.label }}</span>
    </template>
    <template #content="{ item }">
      <slot name="sheet" :character-id="item.value" />
    </template>
  </UTabs>
</template>
