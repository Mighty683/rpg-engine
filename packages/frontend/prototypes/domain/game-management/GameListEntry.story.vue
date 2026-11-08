<script setup lang="ts">
import GameListEntry from "../../../src/modules/games/GameListEntry.vue";
import type { Game } from "../../../src/modules/games/api";
const game: Game = {
  id: "lantern-road",
  name: "The Lantern Road",
  system: { id: "fabula-ultima", name: "Fabula Ultima" },
  createdAt: "2026-01-01T00:00:00Z",
  role: "GM" as "GM" | "Player",
};
function initialState() {
  return { role: "GM" as "GM" | "Player" };
}
</script>

<template>
  <Story title="Domain/Game management/Game list entry" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default p-section text-default">
          <ul class="max-w-xl rounded-panel border border-default">
            <GameListEntry
              :game="{ ...game, role: state.role }"
              :system-label="`System: ${game.system.name}`"
            />
          </ul>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }"
      ><HstSelect v-model="state.role" title="Role" :options="['GM', 'Player']"
    /></template>
  </Story>
</template>
