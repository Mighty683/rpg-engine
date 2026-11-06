<script setup lang="ts">
import { computed, ref } from "vue";
import DesignSystem from "./design-system/DesignSystem.vue";
import GameSeparationPrototype from "./gm-player-separation/GameSeparationPrototype.vue";

const prototypes = [
  {
    id: "gm-player-separation",
    name: "GM and player separation",
    component: GameSeparationPrototype,
  },
  { id: "design-system", name: "Design system", component: DesignSystem },
];
const selectedId = ref(prototypes[0]!.id);
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
      </header>
      <component :is="selected.component" v-if="selected" :key="selected.id" />
    </div>
  </UApp>
</template>
