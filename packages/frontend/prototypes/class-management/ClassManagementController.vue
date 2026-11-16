<script setup lang="ts">
import ClassCatalogController from "../../src/modules/class-management/ClassCatalogController.vue";
import ProgressionPrototype from "../class-progression/ProgressionPrototype.vue";

defineProps<{ screen: string; context: string }>();
defineEmits<{ navigate: [screen: string]; switchContext: [context: string] }>();
</script>

<template>
  <ClassCatalogController
    :screen="screen"
    :context="context"
    game-name="The Lantern Road"
    @navigate="$emit('navigate', $event)"
    @switch-context="$emit('switchContext', $event)"
  >
    <template #characters><ProgressionPrototype /></template>
  </ClassCatalogController>
</template>
