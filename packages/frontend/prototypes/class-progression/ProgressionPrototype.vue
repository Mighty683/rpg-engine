<script setup lang="ts">
import { provide } from "vue";
import { progressionApiKey } from "../../src/modules/class-progression/services";
import { progressionApi } from "./api";
import ProgressionController from "./ProgressionController.vue";
defineProps<{ readOnly?: boolean; playerCharacterId?: string }>();
provide(progressionApiKey, progressionApi);
</script>
<template>
  <ProgressionController :read-only="readOnly" :player-character-id="playerCharacterId" />
</template>
