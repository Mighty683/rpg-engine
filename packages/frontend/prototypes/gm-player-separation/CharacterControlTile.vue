<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import { gmControl, type CharacterView, type Option, type Role } from "./model";

const props = defineProps<{ character: CharacterView; role: Role; controllers: Option[] }>();
const emit = defineEmits<{ assign: [userId: string | null]; setActive: [] }>();
const controller = ref(props.character.controllerId ?? gmControl);
const changed = computed(() => controller.value !== (props.character.controllerId ?? gmControl));
watch(
  () => props.character.controllerId,
  (id) => {
    controller.value = id ?? gmControl;
  },
);
</script>

<template>
  <ScreenSection class="h-full space-y-medium p-large">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h3 class="font-semibold">{{ character.sheet.identity.name || "Unnamed character" }}</h3>
      <UBadge
        :color="character.active || !character.controllerId ? 'success' : 'neutral'"
        variant="subtle"
      >
        {{ character.active || !character.controllerId ? "Active" : "Inactive" }}
      </UBadge>
    </div>
    <p class="text-muted">
      {{ character.controllerId ? `Controlled by ${character.controller}` : character.controller }}
    </p>
    <form
      v-if="role === 'GM'"
      class="space-y-medium"
      @submit.prevent="changed && emit('assign', controller === gmControl ? null : controller)"
    >
      <UFormField
        :label="`Assign control for ${character.sheet.identity.name || 'unnamed character'}`"
      >
        <USelect v-model="controller" :items="controllers" value-key="id" class="w-full" />
      </UFormField>
      <UButton
        type="submit"
        :color="changed ? 'primary' : 'neutral'"
        :variant="changed ? 'solid' : 'outline'"
        :disabled="!changed"
        >Update control</UButton
      >
    </form>
    <UButton
      v-else-if="character.editable && !character.active"
      color="neutral"
      variant="outline"
      @click="emit('setActive')"
      >Make active</UButton
    >
  </ScreenSection>
</template>
