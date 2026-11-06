<script setup lang="ts">
import CharacterControlTile from "./CharacterControlTile.vue";
import type { CharacterView, Option, Role } from "./model";

defineProps<{ role: Role; characters: CharacterView[]; controllers: Option[] }>();
const emit = defineEmits<{
  assign: [characterId: string, userId: string | null];
  setActive: [characterId: string];
}>();
</script>

<template>
  <p v-if="!characters.length" class="text-muted">There are no characters to manage yet.</p>
  <ul v-else class="grid gap-medium sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="character in characters" :key="character.id">
      <CharacterControlTile
        :character="character"
        :role="role"
        :controllers="controllers"
        @assign="emit('assign', character.id, $event)"
        @set-active="emit('setActive', character.id)"
      />
    </li>
  </ul>
</template>
