<script setup lang="ts">
import GameTable from "../game-table/GameTable.vue";
import AgentRollCard from "./AgentRollCard.vue";
import AgentRollResult from "./AgentRollResult.vue";
import AgentEditReview from "./AgentEditReview.vue";
import AgentPanel from "./AgentPanel.vue";
import { useAgentChat } from "./useAgentChat";

const props = defineProps<{ gameId: string; throwsHint: number; npcsHint?: number }>();
const {
  draft,
  messages,
  available,
  checking,
  busy,
  action,
  actionTurnId,
  rolled,
  setOpen,
  older,
  submit,
} = useAgentChat(props.gameId);
</script>

<template>
  <GameTable
    :game-id="gameId"
    role="GM"
    :throws-hint="throwsHint"
    :npcs-hint="npcsHint"
    :extra-edge-tab="{ id: 'agent', label: 'Agent', color: 'neutral' }"
    @agent-open="setOpen"
  >
    <template #extra-edge-panel="{ party, npcActors, partyReady, partyLoading, saveReviewedNpc }">
      <AgentPanel
        v-model:draft="draft"
        :messages="messages"
        :available="available"
        :checking="checking"
        :busy="busy"
        :party-ready="partyReady"
        :party-loading="partyLoading"
        @submit="submit"
        @older="older"
      >
        <template #after-message="{ message }">
          <AgentRollResult v-if="message.roll" :roll="message.roll" />
          <AgentRollCard
            v-else-if="action?.kind === 'roll' && message.id === actionTurnId + '-reply'"
            :key="actionTurnId"
            :game-id="gameId"
            :turn-id="actionTurnId"
            :action="action"
            :actors="[...party, ...npcActors]"
            @rolled="rolled"
          />
          <AgentEditReview
            v-else-if="action && action.kind !== 'roll' && message.id === actionTurnId + '-reply'"
            :key="actionTurnId"
            :game-id="gameId"
            :action="action"
            :save-npc="saveReviewedNpc"
            @dismiss="action = undefined"
          />
        </template>
      </AgentPanel>
    </template>
  </GameTable>
</template>
