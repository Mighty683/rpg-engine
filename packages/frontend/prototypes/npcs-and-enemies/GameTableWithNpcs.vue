<script setup lang="ts">
/** Prototype composition explicitly binds the NPC HTTP service; controllers require injection. */
import { provide } from "vue";
import { npcApi, npcApiKey } from "./npc-api";
import GameTableWithNpcsController from "./GameTableWithNpcsController.vue";
import type { TableRole, TableScenario } from "./types";
defineProps<{ role?: TableRole; view?: TableScenario; gameId?: string }>();
provide(npcApiKey, npcApi);
</script>
<template><GameTableWithNpcsController :role="role" :view="view" :game-id="gameId" /></template>
