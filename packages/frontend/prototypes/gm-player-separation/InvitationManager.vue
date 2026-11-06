<script setup lang="ts">
import { ref } from "vue";
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import type { InvitationRow, Option } from "./model";

defineProps<{ links: InvitationRow[]; availableCharacters: Option[] }>();
const emit = defineEmits<{
  create: [characterId: string];
  copy: [url: string];
  toggle: [id: string];
  rotate: [id: string];
}>();
const characterId = ref("");
const error = ref("");

function create() {
  if (!characterId.value) {
    error.value = "Choose a character.";
    return;
  }
  error.value = "";
  emit("create", characterId.value);
  characterId.value = "";
}
</script>

<template>
  <div class="space-y-section">
    <section aria-labelledby="existing-links" class="space-y-medium">
      <h3 id="existing-links" class="text-section font-semibold">Invitation links</h3>
      <p class="text-muted">
        The game link is reusable. Changes to one link apply to that link only.
      </p>
      <ScreenSection aria-labelledby="new-character-link" class="space-y-medium p-large">
        <div class="space-y-small">
          <h4 id="new-character-link" class="font-semibold">New character link</h4>
          <p class="text-muted">
            A single-use link lets a player join and claim an unassigned character.
          </p>
        </div>
        <form
          v-if="availableCharacters.length"
          class="flex flex-wrap items-end gap-medium"
          @submit.prevent="create"
        >
          <UFormField label="Character" :error="error" class="w-full sm:max-w-xs">
            <USelect
              v-model="characterId"
              :items="availableCharacters"
              value-key="id"
              placeholder="Choose a character"
              class="w-full"
            />
          </UFormField>
          <UButton type="submit">Create link</UButton>
        </form>
        <p v-else>All characters are assigned. Take one back or create a new character first.</p>
      </ScreenSection>
      <ul class="space-y-medium">
        <li
          v-for="link in links"
          :key="link.id"
          class="flex flex-wrap items-center justify-between gap-large rounded-panel border border-default p-large"
        >
          <div class="space-y-small">
            <div class="flex flex-wrap items-center gap-small">
              <h4 class="font-semibold">{{ link.title }}</h4>
              <UBadge :color="link.status === 'Enabled' ? 'success' : 'neutral'" variant="subtle">
                {{ link.status }}
              </UBadge>
            </div>
            <p class="break-all text-muted">{{ link.url }}</p>
          </div>
          <div v-if="!link.spent" class="flex flex-wrap gap-small">
            <UButton variant="outline" color="neutral" @click="emit('copy', link.url)"
              >Copy link</UButton
            >
            <UButton variant="subtle" color="neutral" @click="emit('toggle', link.id)">
              {{ link.enabled ? "Disable" : "Enable" }}
            </UButton>
            <UButton variant="subtle" color="neutral" @click="emit('rotate', link.id)"
              >Rotate</UButton
            >
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
