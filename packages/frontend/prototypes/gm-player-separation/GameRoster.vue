<script setup lang="ts">
import { computed, ref } from "vue";
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import CharacterPreview from "./CharacterPreview.vue";
import type { CharacterView, Option, Resource, Role } from "./model";

const props = defineProps<{
  role: Role;
  characters: CharacterView[];
  copySources: Option[];
}>();
const selectedId = defineModel<string>({ required: true });
const emit = defineEmits<{
  create: [name: string];
  copy: [id: string];
  manage: [];
  overrideMaximum: [id: string, resource: Resource, value: number | null];
}>();

const dialog = ref<"create" | "copy" | null>(null);
const name = ref("");
const source = ref("");
const error = ref("");
const tabs = computed(() => {
  const items = props.characters
    .filter((character) => character.active || !character.controllerId)
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

function start(action: "create" | "copy") {
  name.value = "";
  source.value = "";
  error.value = "";
  dialog.value = action;
}

function submit() {
  if (dialog.value === "create" && name.value.trim()) {
    emit("create", name.value.trim());
  } else if (dialog.value === "copy" && source.value) {
    emit("copy", source.value);
  } else {
    error.value = dialog.value === "create" ? "Enter a character name." : "Choose a character.";
    return;
  }
  dialog.value = null;
}
</script>

<template>
  <div class="space-y-section">
    <section aria-label="Characters" class="min-w-0 space-y-medium">
      <p v-if="role === 'Player' && !hasOwnCharacter" class="text-muted">
        You have no characters yet. Create one, copy one, or ask your GM to assign one.
      </p>
      <ScreenSection v-if="!tabs.length">
        <p class="p-small text-muted">
          No active characters yet. Create a character or select one in character management.
        </p>
      </ScreenSection>
      <div>
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
          <template #list-trailing>
            <div class="ml-auto flex shrink-0 items-center gap-small">
              <UButton @click="start('create')">Create character</UButton>
              <UButton
                v-if="role === 'Player'"
                color="neutral"
                variant="outline"
                @click="start('copy')"
                >Copy character</UButton
              >
              <UButton color="neutral" variant="outline" @click="emit('manage')"
                >Characters management</UButton
              >
            </div>
          </template>
          <template #content="{ item }">
            <CharacterPreview
              :character="item.character"
              @override-maximum="
                (resource, value) => emit('overrideMaximum', item.value, resource, value)
              "
            />
          </template>
        </UTabs>
        <div v-if="!tabs.length" class="flex flex-wrap gap-small">
          <UButton @click="start('create')">Create character</UButton>
          <UButton
            v-if="role === 'Player'"
            color="neutral"
            variant="outline"
            @click="start('copy')"
          >
            Copy character
          </UButton>
          <UButton color="neutral" variant="outline" @click="emit('manage')"
            >Characters management</UButton
          >
        </div>
      </div>
    </section>

    <UModal
      :open="dialog !== null"
      :title="dialog === 'copy' ? 'Copy a character' : 'Create a character'"
      @update:open="
        (open: boolean) => {
          if (!open) dialog = null;
        }
      "
    >
      <template #body>
        <form class="space-y-medium" @submit.prevent="submit">
          <UFormField v-if="dialog === 'create'" label="Character name" :error="error">
            <UInput v-model="name" class="w-full" />
          </UFormField>
          <template v-else>
            <p class="text-muted">
              Copy the full sheet into this game. The original stays in its game.
            </p>
            <UFormField
              v-if="copySources.length"
              label="Your characters in other games"
              :error="error"
            >
              <USelect
                v-model="source"
                :items="copySources"
                value-key="id"
                placeholder="Choose a character"
                class="w-full"
              />
            </UFormField>
            <p v-else>No eligible characters from another game use this RPG system.</p>
          </template>
          <div class="flex flex-wrap justify-end gap-small">
            <UButton type="button" variant="outline" color="neutral" @click="dialog = null">
              Cancel
            </UButton>
            <UButton v-if="dialog === 'create' || copySources.length" type="submit">
              {{ dialog === "copy" ? "Copy character" : "Create character" }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
