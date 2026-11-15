<script setup lang="ts">
import { progressionPlayerCharacterId } from "../mock-backend/progression-seed";
import ProgressionPrototype from "./ProgressionPrototype.vue";
</script>

<template>
  <Story title="Prototypes/Player views">
    <UApp><ProgressionPrototype :player-character-id="progressionPlayerCharacterId" /></UApp>
  </Story>
</template>
