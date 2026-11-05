<script setup lang="ts">
import { computed, ref } from "vue";
import DesignSystem from "./design-system/DesignSystem.vue";
import ExamplePrototype from "./examples/ExamplePrototype.vue";

const prototypes = [
  { id: "design-system", name: "Design system", component: DesignSystem },
  { id: "example", name: "Example", component: ExamplePrototype },
];
const dark = ref(false);
const selectedId = ref(prototypes[0]!.id);
const selected = computed(() => prototypes.find((prototype) => prototype.id === selectedId.value));
</script>

<template>
  <UApp>
    <div :class="{ dark }" class="min-h-screen bg-default text-default">
      <header class="border-b border-default p-large">
        <label for="prototype" class="mr-medium font-semibold">UI prototype</label>
        <select id="prototype" v-model="selectedId" class="rounded border border-default p-small">
          <option v-for="prototype in prototypes" :key="prototype.id" :value="prototype.id">
            {{ prototype.name }}
          </option>
        </select>
        <button
          type="button"
          class="ml-large rounded-panel border border-default p-small"
          :aria-pressed="dark"
          @click="dark = !dark"
        >
          {{ dark ? "Light theme" : "Dark theme" }}
        </button>
      </header>
      <component :is="selected.component" v-if="selected" :key="selected.id" />
    </div>
  </UApp>
</template>
