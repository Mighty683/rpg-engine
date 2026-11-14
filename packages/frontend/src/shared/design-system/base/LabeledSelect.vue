<script setup lang="ts" generic="T extends string | number">
import { computed, ref, useAttrs } from "vue";
import type { SelectOption } from "./types";

defineOptions({ inheritAttrs: false });
defineProps<{
  label: string;
  items: SelectOption<T>[];
  hint?: string;
  description?: string;
  error?: string;
  name?: string;
  required?: boolean;
}>();
const model = defineModel<T>();
const attrs = useAttrs();
const select = ref<{ triggerRef?: HTMLElement }>();
defineExpose({ triggerRef: computed(() => select.value?.triggerRef) });
function controlAttrs() {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "class"));
}
</script>

<template>
  <UFormField
    :class="attrs.class"
    :label="label"
    :hint="hint"
    :description="description"
    :error="error"
    :name="name"
    :required="required"
    :ui="{ container: 'mt-input-label' }"
  >
    <USelect
      ref="select"
      v-model="model"
      :items="items"
      v-bind="controlAttrs()"
      size="md"
      class="w-full"
    >
      <template v-if="$slots['item-label']" #item-label="{ item }">
        <slot name="item-label" :item="item" />
      </template>
    </USelect>
    <slot />
  </UFormField>
</template>
