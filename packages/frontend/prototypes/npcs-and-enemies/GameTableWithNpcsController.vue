<script setup lang="ts">
/** Composition root for the persisted NPC table prototype. */
import { toRef } from "vue";
import { useApiServices } from "../../src/shared/api-services";
import { useNpcApi } from "./npc-api";
import { prototypeGameId } from "../api";
import { useNpcTable } from "./useNpcTable";
import GameTableWithNpcsView from "./GameTableWithNpcsView.vue";
import type { TableRole, TableScenario } from "./types";
const props = withDefaults(
  defineProps<{ role?: TableRole; view?: TableScenario; gameId?: string }>(),
  {
    role: "GM",
    view: "Mixed",
    gameId: prototypeGameId,
  },
);
const table = useNpcTable(
  useApiServices(),
  useNpcApi(),
  props.gameId,
  toRef(props, "role"),
  toRef(props, "view"),
);
</script>
<template><GameTableWithNpcsView :table="table" /></template>
