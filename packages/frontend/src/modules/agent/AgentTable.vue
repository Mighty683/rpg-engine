<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useCreateThrowMutation } from "../game-table/hooks";
import { rollPreview } from "./roll-preview";
import GameTable from "../game-table/GameTable.vue";
import AgentRollCard from "./AgentRollCard.vue";
import AgentRollResult from "./AgentRollResult.vue";
import AgentEditController from "./AgentEditController.vue";
import AgentPanel from "./AgentPanel.vue";
import NotesDrawerPanel from "../game-notes/NotesDrawerPanel.vue";
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
const mutation = useCreateThrowMutation(props.gameId);
const toast = useToast();
const submitting = ref(false);

async function makeRoll(privateRoll: boolean) {
  const proposal = action.value;
  const turnId = actionTurnId.value;
  if (submitting.value || proposal?.kind !== "roll") return;
  submitting.value = true;
  try {
    const result = await mutation.mutateAsync({
      ...proposal.input,
      agentTurnId: turnId,
      private: privateRoll,
    });
    rolled(turnId, result.throw);
  } catch (error) {
    const problem = error as { payload?: { error?: { message?: string } } };
    toast.add({
      title: tr("ui.couldNotConfirmTheRoll"),
      description: problem.payload?.error?.message,
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <GameTable
    :game-id="gameId"
    role="GM"
    :throws-hint="throwsHint"
    :npcs-hint="npcsHint"
    :extra-edge-tab="{ id: 'agent', label: tr('ui.agent'), color: 'neutral' }"
    :panel-tab="{ id: 'notes', label: tr('ui.gameNotes'), color: 'neutral' }"
    @agent-open="setOpen"
  >
    <template #edge-panel>
      <NotesDrawerPanel :game-id="gameId" />
    </template>
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
            :summary="rollPreview(action, [...party, ...npcActors])"
            :target-label="action.targetLabel"
            :initially-private="action.input.private === true"
            :submitting="submitting"
            :on-roll="makeRoll"
          />
          <AgentEditController
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
