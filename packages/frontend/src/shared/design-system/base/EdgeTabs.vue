<script setup lang="ts">
import { computed } from "vue";

export type EdgeTab = {
  id: string;
  label: string;
  color?: "primary" | "warning" | "neutral" | "info" | "success" | "error";
  testId?: string;
  width?: "medium" | "wide";
};

const props = withDefaults(
  defineProps<{ tabs: EdgeTab[]; overlap?: number; tabsOnly?: boolean }>(),
  {
    overlap: 0.6,
  },
);
const emit = defineEmits<{ open: [id: string | null] }>();

const openId = defineModel<string | null>("openId", { default: null });
const activeTab = computed(() => props.tabs.find((tab) => tab.id === openId.value));
const visibleTabs = computed(() => (activeTab.value ? [activeTab.value] : props.tabs));

function select(id: string) {
  const nextId = openId.value === id ? null : id;
  openId.value = nextId;
  emit("open", nextId);
}
</script>

<template>
  <div class="edge-tabs" role="tablist" aria-label="Side panels">
    <UButton
      v-for="(tab, index) in visibleTabs"
      :key="tab.id"
      class="edge-tab"
      :style="index > 0 ? { marginTop: `-${props.overlap}rem` } : undefined"
      :color="tab.color ?? 'primary'"
      :data-testid="tab.testId ?? `edge-tab-${tab.id}`"
      :aria-label="openId === tab.id ? `Close ${tab.label}` : tab.label"
      :aria-pressed="openId === tab.id"
      @click="select(tab.id)"
      >{{ tab.label }}</UButton
    >
  </div>
  <USlideover
    v-if="!tabsOnly"
    :open="openId !== null"
    :title="activeTab?.label ?? ''"
    :ui="{ content: activeTab?.width === 'wide' ? 'w-full sm:max-w-4xl' : 'w-full sm:max-w-xl' }"
    @update:open="
      (v: boolean) => {
        if (!v && openId) select(openId);
      }
    "
  >
    <template #body>
      <slot v-if="openId" :name="openId" :tab-id="openId" />
    </template>
  </USlideover>
</template>

<style scoped>
.edge-tabs {
  position: fixed;
  right: 0;
  top: 45%;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.edge-tab {
  writing-mode: vertical-rl;
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
  padding: var(--spacing-medium) var(--spacing-small);
}
</style>
