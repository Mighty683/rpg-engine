<script setup lang="ts">
import { provide } from "vue";
import { classCatalogApiKey } from "../../src/modules/class-management/catalog";
import { classCatalogApi } from "./api";
import ClassManagementController from "./ClassManagementController.vue";

defineProps<{ screen: string; context: string }>();
defineEmits<{ navigate: [screen: string]; switchContext: [context: string] }>();
provide(classCatalogApiKey, classCatalogApi);
</script>

<template>
  <ClassManagementController
    :screen="screen"
    :context="context"
    @navigate="$emit('navigate', $event)"
    @switch-context="$emit('switchContext', $event)"
  />
</template>
