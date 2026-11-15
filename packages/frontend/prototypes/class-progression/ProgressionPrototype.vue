<script setup lang="ts">
import { provide } from "vue";
import { progressionApiKey } from "../../src/modules/class-progression/services";
import { createProgressionApi } from "./api";
import ProgressionController from "./ProgressionController.vue";
const props = defineProps<{ readOnly?: boolean; playerCharacterId?: string }>();
provide(progressionApiKey, createProgressionApi(props.playerCharacterId));
</script>
<template>
  <ProgressionController :read-only="readOnly" :player-character-id="playerCharacterId" />
</template>
