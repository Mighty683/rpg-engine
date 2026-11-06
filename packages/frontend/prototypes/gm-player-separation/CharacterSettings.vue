<script setup lang="ts">
import { computed } from "vue";
import CharacterControlTile from "./CharacterControlTile.vue";
import { gmControl, type CharacterView, type Option, type Role } from "./model";

const props = defineProps<{ role: Role; characters: CharacterView[]; controllers: Option[] }>();
const emit = defineEmits<{
  assign: [characterId: string, userId: string | null];
  setActive: [characterId: string, active: boolean];
  open: [characterId: string];
}>();

const groups = computed(() => {
  const byController = new Map<string, CharacterView[]>();
  for (const character of props.characters) {
    const id = character.controllerId ?? gmControl;
    const group = byController.get(id);
    if (group) group.push(character);
    else byController.set(id, [character]);
  }
  return Array.from(byController, ([id, characters]) => {
    const first = characters[0]!;
    return {
      id,
      label: id === gmControl ? "GM characters" : first.controller,
      openByDefault: props.role === "GM" ? id === gmControl : first.editable,
      characters,
    };
  }).sort((a, b) => Number(b.openByDefault) - Number(a.openByDefault) || a.label.localeCompare(b.label));
});
</script>

<template>
  <p v-if="!groups.length" class="text-muted">There are no characters to manage yet.</p>
  <div v-else class="space-y-medium">
    <details
      v-for="group in groups"
      :key="group.id"
      :open="group.openByDefault"
      class="rounded-panel border border-default"
    >
      <summary class="cursor-pointer rounded-panel p-medium font-semibold hover:bg-elevated">
        {{ group.label }}
        <UBadge color="neutral" variant="subtle" class="ms-small">
          {{ group.characters.length }}
          {{ group.characters.length === 1 ? "character" : "characters" }}
        </UBadge>
      </summary>
      <ul class="grid gap-medium p-medium sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="character in group.characters" :key="character.id">
          <CharacterControlTile
            :character="character"
            :role="role"
            :controllers="controllers"
            @assign="emit('assign', character.id, $event)"
            @set-active="emit('setActive', character.id, $event)"
            @open="emit('open', character.id)"
          />
        </li>
      </ul>
    </details>
  </div>
</template>
