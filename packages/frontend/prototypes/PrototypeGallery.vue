<script setup lang="ts">
import { computed, ref } from "vue";
import DesignSystem from "./design-system/DesignSystem.vue";
import GameTablePrototype from "./game-table/GameTablePrototype.vue";

const prototypes = [
  {
    id: "game-table",
    name: "Game Table",
    component: GameTablePrototype,
  },
  { id: "design-system", name: "Design system", component: DesignSystem },
];
const selectedId = ref(prototypes[0]!.id);
const previewRole = ref<"GM" | "Player">("GM");
const selected = computed(() => prototypes.find((prototype) => prototype.id === selectedId.value));
</script>

<template>
  <UApp>
    <div class="min-h-screen bg-default text-default">
      <header class="border-b border-default p-large">
        <label for="prototype" class="mr-medium font-semibold">UI gallery</label>
        <select id="prototype" v-model="selectedId" class="rounded border border-default p-small">
          <option v-for="prototype in prototypes" :key="prototype.id" :value="prototype.id">
            {{ prototype.name }}
          </option>
        </select>
        <template v-if="selectedId === 'game-table'">
          <label for="preview-role" class="mx-medium font-semibold">Preview role</label>
          <select id="preview-role" v-model="previewRole" class="rounded border border-default p-small">
            <option value="GM">GM</option>
            <option value="Player">Player</option>
          </select>
        </template>
      </header>
      <component :is="selected.component" v-if="selected" :key="selected.id" v-bind="selected.id === 'game-table' ? { role: previewRole } : {}" />
    </div>
  </UApp>
</template>
