<script setup lang="ts">
import type { GameCharacterSummary } from "../characters/types";
import type { GameMember } from "./types";

import { computed } from "vue";

import CharacterControlTile from "./CharacterControlTile.vue";

const props = defineProps<{ characters: GameCharacterSummary[]; members: GameMember[]; role: "GM" | "Player"; pending: boolean }>();
const emit = defineEmits<{
  open: [id: string];
  assign: [id: string, membershipId: string | null];
  setActive: [id: string, active: boolean];
  remove: [id: string];
}>();
const groups = computed(() => {
  const groups = new Map<string, GameCharacterSummary[]>();
  for (const character of props.characters) {
    const key = character.controllerMembershipId ?? "gm";
    const group = groups.get(key) ?? [];
    group.push(character);
    groups.set(key, group);
  }
  return Array.from(groups, ([id, characters]) => ({
    id,
    label: id === "gm" ? "GM characters" : characters[0]?.controllerName ?? "Player",
    own: props.role === "GM" ? id === "gm" : characters.some((character) => character.canEdit),
    characters,
  })).sort((a, b) => Number(b.own) - Number(a.own) || a.label.localeCompare(b.label));
});
</script>

<template>
  <p v-if="!groups.length" class="text-muted">There are no characters to manage yet.</p>
  <div v-else class="space-y-medium">
    <details v-for="group in groups" :key="group.id" :open="group.own" class="rounded-panel border border-default">
      <summary class="cursor-pointer p-medium font-semibold">{{ group.label }} <UBadge color="neutral" variant="subtle">{{ group.characters.length }} {{ group.characters.length === 1 ? "character" : "characters" }}</UBadge></summary>
      <ul class="grid gap-medium p-medium sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="character in group.characters" :key="character.id">
          <CharacterControlTile :character="character" :role="role" :members="members" :pending="pending" @open="emit('open', character.id)" @assign="emit('assign', character.id, $event)" @set-active="emit('setActive', character.id, $event)" @remove="emit('remove', character.id)" />
        </li>
      </ul>
    </details>
  </div>
</template>
