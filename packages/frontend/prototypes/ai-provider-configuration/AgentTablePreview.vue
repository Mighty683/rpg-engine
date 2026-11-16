<script setup lang="ts">
import { ref } from "vue";
import GameTable from "../../src/modules/game-table/GameTable.vue";
import type { PartyCharacter } from "../../src/modules/game-table/types";
import type { EdgeTab } from "../../src/shared/design-system/base/EdgeTabs.vue";
import { prototypeGameId } from "../api";
import AgentPanel from "./AgentPanel.vue";

const props = defineProps<{ available: boolean }>();

const agentTab: EdgeTab = { id: "agent", label: "Agent", color: "neutral" };
const example = "Show active party";
const draft = ref("");
const reply = ref("");

function runCommand(party: readonly PartyCharacter[]) {
  const command = draft.value.trim().toLowerCase();
  if (!props.available || !command) return;

  if (command !== example.toLowerCase()) {
    reply.value = `Try “${example}” in this prototype.`;
    return;
  }

  const names = party.map(({ name }) => name).join(", ");
  reply.value = names ? `Active party: ${names}.` : "There are no active characters.";
  draft.value = "";
}
</script>

<template>
  <div class="min-h-screen bg-default p-section text-default">
    <main class="mx-auto max-w-6xl space-y-section">
      <header>
        <h1 class="text-heading font-semibold">The Lantern Road</h1>
        <p class="text-muted">Fabula Ultima · GM</p>
      </header>
      <GameTable :game-id="prototypeGameId" role="GM" :throws-hint="0" :extra-edge-tab="agentTab">
        <template #extra-edge-panel="{ party, partyReady, partyLoading }">
          <AgentPanel
            v-model:draft="draft"
            :available="available"
            :party-ready="partyReady"
            :party-loading="partyLoading"
            :example="example"
            :reply="reply"
            @submit="runCommand(party)"
          />
        </template>
      </GameTable>
    </main>
  </div>
</template>
