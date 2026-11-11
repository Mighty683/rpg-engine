<script setup lang="ts">
/** Prototype composition explicitly binds the NPC HTTP service; controllers require injection. */
import { provide } from "vue";
import { QueryClient, VUE_QUERY_CLIENT } from "@tanstack/vue-query";
import { npcApi, npcApiKey } from "./npc-api";
import GameTableWithNpcsController from "./GameTableWithNpcsController.vue";
import type { TableRole, TableScenario } from "./types";
defineProps<{ role?: TableRole; view?: TableScenario; gameId?: string }>();
provide(npcApiKey, npcApi);
provide(VUE_QUERY_CLIENT, new QueryClient());
</script>
<template><GameTableWithNpcsController :role="role" :view="view" :game-id="gameId" /></template>
