<script setup lang="ts">
import { newUuid } from "../../src/shared/uuid";
import { ref } from "vue";
import GameTable from "../../src/modules/game-table/GameTable.vue";
import type { PartyCharacter } from "../../src/modules/game-table/types";
import type { EdgeTab } from "../../src/shared/design-system/base/EdgeTabs.vue";
import { prototypeGameId } from "../api";
import AgentPanel from "../../src/modules/agent/AgentPanel.vue";
import type { ChatMessage } from "../../src/modules/agent/types";

const props = defineProps<{ available: boolean }>();

const agentTab: EdgeTab = { id: "agent", label: "Agent", color: "neutral" };
const draft = ref("");
const messages = ref<ChatMessage[]>([
  { id: newUuid(), role: "user", text: "Who is in the party?" },
  { id: newUuid(), role: "tool", text: "Read active party" },
  { id: newUuid(), role: "agent", text: "At the table today: Rowan Ash, Nera Vale." },
]);

function runCommand(party: readonly PartyCharacter[]) {
  const command = draft.value.trim().toLowerCase();
  if (!props.available || !command) return;

  messages.value.push({ id: newUuid(), role: "user", text: draft.value.trim() });
  const names = party.map(({ name }) => name).join(", ");
  let text = "In this prototype, I can tell you who’s at the table. Ask me about the party.";
  if (/party|who.*table/i.test(command)) {
    messages.value.push({ id: newUuid(), role: "tool", text: "Read active party" });
    text = names
      ? `At the table today: ${names}.`
      : "There are no active characters at the table yet.";
  }
  messages.value.push({ id: newUuid(), role: "agent", text });
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
            :messages="messages"
            @submit="runCommand(party)"
          />
        </template>
      </GameTable>
    </main>
  </div>
</template>
