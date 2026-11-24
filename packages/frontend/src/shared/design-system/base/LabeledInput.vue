<script setup lang="ts">
import { computed, ref, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });
defineProps<{
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  name?: string;
  required?: boolean;
  multiline?: boolean;
}>();
const attrs = useAttrs();
// useAttrs is updated on render but is not reactive; do not cache forwarded attributes.
function inputAttrs() {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "class"));
}
const model = defineModel<string | number>();
const input = ref<{ inputRef?: HTMLInputElement }>();
defineExpose({ inputRef: computed(() => input.value?.inputRef) });
</script>

<template>
  <UFormField
    :class="attrs.class"
    :label="label"
    :hint="hint"
    :error="error"
    :name="name"
    :required="required"
    :ui="{
      label: hideLabel ? 'sr-only' : undefined,
      container: hideLabel ? 'mt-0' : 'mt-input-label',
    }"
  >
    <UTextarea
      v-if="multiline"
      v-model="model"
      v-bind="inputAttrs()"
      size="md"
      class="w-full"
      :required="required"
    />
    <UInput
      v-else
      ref="input"
      v-model="model"
      v-bind="inputAttrs()"
      size="md"
      class="w-full"
      :required="required"
    />
  </UFormField>
</template>
