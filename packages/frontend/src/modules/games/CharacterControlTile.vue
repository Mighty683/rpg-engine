<script setup lang="ts">
import type { GameCharacterSummary } from "../characters/types";
import type { GameMember } from "./types";

import { computed, ref, watch } from "vue";

import ScreenSection from "../../shared/design-system/ScreenSection.vue";

const props = defineProps<{ character: GameCharacterSummary; role: "GM" | "Player"; members: GameMember[]; pending: boolean }>();
const emit = defineEmits<{
  open: [];
  assign: [membershipId: string | null];
  setActive: [active: boolean];
  remove: [];
}>();
const gm = "gm";
const controller = ref(props.character.controllerMembershipId ?? gm);
const choices = computed(() => [
  { label: "GM", value: gm },
  ...props.members.filter((member) => !member.removed).map((member) => ({ label: member.name, value: member.id })),
]);
const changed = computed(() => controller.value !== (props.character.controllerMembershipId ?? gm));
const canActivate = computed(() => props.role === "GM" || props.character.canEdit);
watch(() => props.character.controllerMembershipId, (value) => { controller.value = value ?? gm; });
</script>

<template>
  <ScreenSection class="h-full space-y-medium p-large" data-testid="character-control-tile">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h3 class="font-semibold">{{ character.name }}</h3>
      <UBadge :color="character.active ? 'success' : 'neutral'" variant="subtle">{{ character.active ? "Active" : "Inactive" }}</UBadge>
    </div>
    <p class="text-muted">{{ character.controllerMembershipId ? `Controlled by ${character.controllerName}` : "GM controlled" }}</p>
    <form v-if="role === 'GM'" class="space-y-medium" @submit.prevent="changed && emit('assign', controller === gm ? null : controller)">
      <UFormField :label="`Assign control for ${character.name}`">
        <USelect v-model="controller" :items="choices" value-key="value" class="w-full" />
      </UFormField>
      <UButton type="submit" :disabled="!changed || pending" :color="changed ? 'primary' : 'neutral'" :variant="changed ? 'solid' : 'outline'">Update control</UButton>
    </form>
    <div class="flex flex-wrap gap-small">
      <UButton color="neutral" variant="outline" @click="emit('open')">Open sheet</UButton>
      <UButton v-if="canActivate" data-testid="set-active" color="neutral" variant="outline" :disabled="pending" @click="emit('setActive', !character.active)">{{ character.active ? "Make inactive" : "Make active" }}</UButton>
      <UButton v-if="role === 'GM' || character.canEdit" color="error" variant="outline" :disabled="pending" @click="emit('remove')">Remove</UButton>
    </div>
  </ScreenSection>
</template>
