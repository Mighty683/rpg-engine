<script setup lang="ts">
import { tr } from "../../shared/i18n";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import type { GameCharacterSummary } from "../characters/types";
import type { GameMember } from "./types";

import { computed, ref, watch } from "vue";

import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";

const props = defineProps<{
  character: GameCharacterSummary;
  role: "GM" | "Player";
  members: GameMember[];
  pending: boolean;
}>();
const emit = defineEmits<{
  open: [];
  assign: [membershipId: string | null];
  setActive: [active: boolean];
  remove: [];
}>();
const gm = "gm";
const controller = ref(props.character.controllerMembershipId ?? gm);
const choices = computed(() => [
  { label: tr("ui.gm"), value: gm },
  ...props.members
    .filter((member) => !member.removed)
    .map((member) => ({ label: member.name, value: member.id })),
]);
const changed = computed(() => controller.value !== (props.character.controllerMembershipId ?? gm));
const canActivate = computed(() => props.role === "GM" || props.character.canEdit);
watch(
  () => props.character.controllerMembershipId,
  (value) => {
    controller.value = value ?? gm;
  },
);
</script>

<template>
  <ScreenSection class="h-full space-y-medium p-large" data-testid="character-control-tile">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h3 class="font-semibold">{{ character.name }}</h3>
      <UBadge :color="character.active ? 'success' : 'neutral'" variant="subtle">{{
        character.active ? tr("ui.active") : tr("ui.inactive")
      }}</UBadge>
    </div>
    <p class="text-muted">
      {{
        character.controllerMembershipId
          ? tr("ui.controlledByValue1", { value1: character.controllerName })
          : tr("ui.gmControlled")
      }}
    </p>
    <form
      v-if="role === 'GM'"
      class="space-y-medium"
      @submit.prevent="!pending && changed && emit('assign', controller === gm ? null : controller)"
    >
      <LabeledSelect
        :label="tr('ui.assignControlForValue1', { value1: character.name })"
        v-model="controller"
        :disabled="pending"
        :items="choices"
        class="w-full"
      />
      <UButton
        type="submit"
        :disabled="!changed || pending"
        :color="changed ? 'primary' : 'neutral'"
        :variant="changed ? 'solid' : 'outline'"
        >{{ tr("ui.updateControl") }}</UButton
      >
    </form>
    <div class="flex flex-wrap gap-small">
      <UButton color="neutral" variant="outline" @click="emit('open')">{{
        tr("ui.openSheet")
      }}</UButton>
      <UButton
        v-if="canActivate"
        data-testid="set-active"
        color="neutral"
        variant="outline"
        :disabled="pending"
        @click="emit('setActive', !character.active)"
        >{{ character.active ? tr("ui.makeInactive") : tr("ui.makeActive") }}</UButton
      >
      <UButton
        v-if="role === 'GM' || character.canEdit"
        color="error"
        variant="outline"
        :disabled="pending"
        @click="emit('remove')"
        >{{ tr("ui.remove") }}</UButton
      >
    </div>
  </ScreenSection>
</template>
