<script setup lang="ts">
import { computed, ref } from "vue";
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import CharacterPreview from "./CharacterPreview.vue";
import type { CharacterView, Resource, Role } from "./model";

const props = defineProps<{
  role: Role;
  characters: CharacterView[];
}>();
const selectedId = defineModel<string>({ required: true });
const emit = defineEmits<{
  create: [name: string];
  manage: [];
  overrideMaximum: [id: string, resource: Resource, value: number | null];
}>();

const createOpen = ref(false);
const name = ref("");
const error = ref("");
const tabs = computed(() => {
  const items = props.characters
    .filter((character) => character.active)
    .map((character) => ({
      label: character.sheet.identity.name || "Unnamed character",
      value: character.id,
      character,
    }));
  if (props.role === "GM") return items;
  return [
    ...items.filter(({ character }) => character.editable),
    ...items.filter(({ character }) => !character.editable),
  ];
});
const currentTab = computed({
  get: () =>
    tabs.value.find(({ value }) => value === selectedId.value)?.value ?? tabs.value[0]?.value ?? "",
  set: (value: string | number) => {
    selectedId.value = String(value);
  },
});
const hasOwnCharacter = computed(() => props.characters.some(({ editable }) => editable));

function openCreate() {
  name.value = "";
  error.value = "";
  createOpen.value = true;
}

function submit() {
  const characterName = name.value.trim();
  if (!characterName) {
    error.value = "Enter a character name.";
    return;
  }
  emit("create", characterName);
  createOpen.value = false;
}
</script>

<template>
  <div class="space-y-section">
    <section aria-label="Characters" class="min-w-0 space-y-medium">
      <p v-if="role === 'Player' && !hasOwnCharacter" class="text-muted">
        You have no characters yet. Create one or ask your GM to assign one.
      </p>
      <ScreenSection v-if="!tabs.length">
        <p class="p-small text-muted">
          No active characters yet. Create a character or select one in character management.
        </p>
      </ScreenSection>
      <div class="flex flex-wrap justify-end gap-small">
        <UButton @click="openCreate">Create character</UButton>
        <UButton color="neutral" variant="outline" @click="emit('manage')">
          Characters management
        </UButton>
      </div>
      <UTabs
        v-if="tabs.length"
        v-model="currentTab"
        :items="tabs"
        activation-mode="automatic"
        :ui="{
          list: 'max-w-full overflow-x-auto overflow-y-hidden',
          trigger: 'flex-none',
          content: 'min-w-0',
        }"
      >
        <template #content="{ item }">
          <CharacterPreview
            :character="item.character"
            @override-maximum="
              (resource, value) => emit('overrideMaximum', item.value, resource, value)
            "
          />
        </template>
      </UTabs>
    </section>

    <UModal v-model:open="createOpen" title="Create a character">
      <template #body>
        <form class="space-y-medium" @submit.prevent="submit">
          <UFormField label="Character name" :error="error">
            <UInput v-model="name" class="w-full" />
          </UFormField>
          <div class="flex flex-wrap justify-end gap-small">
            <UButton type="button" variant="outline" color="neutral" @click="createOpen = false">
              Cancel
            </UButton>
            <UButton type="submit">Create character</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
