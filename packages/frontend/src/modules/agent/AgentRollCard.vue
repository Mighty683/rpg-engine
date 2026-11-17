<script setup lang="ts">
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";
import { computed, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useCreateThrowMutation } from "../game-table/hooks";
import type { PartyCharacter, ThrowRecord } from "../game-table/types";
import type { AgentAction } from "./types";

const props = defineProps<{
  gameId: string;
  turnId: string;
  action: Extract<AgentAction, { kind: "roll" }>;
  actors: PartyCharacter[];
}>();
const emit = defineEmits<{ rolled: [id: string, result: ThrowRecord] }>();
const toast = useToast();
const mutation = useCreateThrowMutation(props.gameId);
const privateRoll = ref(props.action.input.private === true);
const submitting = ref(false);
const summary = computed(() => {
  const setup = props.action.input.setup;
  const id = "npcId" in setup ? setup.npcId : setup.characterId;
  const actor = props.actors.find((person) => person.id === id);
  const weaponId =
    "attackId" in setup ? setup.attackId : "equipmentId" in setup ? setup.equipmentId : undefined;
  const weapon = actor?.weapons.find((item) => item.id === weaponId);
  const dice =
    "attributes" in setup
      ? setup.attributes.flatMap((attr) => (attr ? [attr + " d" + setup.dice[attr]] : []))
      : setup.dice.map((size, i) =>
          [weapon?.accuracyDice[i], "d" + size].filter(Boolean).join(" "),
        );
  const modifier = setup.modifier + (weapon?.accuracyBonus ?? 0);
  const formula =
    dice.join(" + ") + (modifier ? " " + (modifier > 0 ? "+" : "−") + Math.abs(modifier) : "");
  const opponent =
    "redDice" in setup && setup.redDice.length
      ? " vs " +
        setup.redDice.map((d) => "d" + d).join(" + ") +
        (setup.redModifier
          ? " " + (setup.redModifier > 0 ? "+" : "−") + Math.abs(setup.redModifier)
          : "")
      : "";
  return {
    name: [actor?.name ?? (id === "gm" ? "GM" : "Roll"), weapon?.name, setup.note]
      .filter(Boolean)
      .join(" · "),
    formula: formula + opponent,
    sizes: [
      ...("attributes" in setup
        ? setup.attributes.flatMap((attr) => (attr && setup.dice[attr] ? [setup.dice[attr]] : []))
        : setup.dice),
      ...("redDice" in setup ? setup.redDice : []),
    ],
  };
});
async function makeRoll() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const result = await mutation.mutateAsync({
      ...props.action.input,
      agentTurnId: props.turnId,
      private: privateRoll.value,
    });
    emit("rolled", props.turnId, result.throw);
  } catch (error) {
    const problem = error as { payload?: { error?: { message?: string } } };
    toast.add({
      title: "Could not confirm the roll",
      description: problem.payload?.error?.message,
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <div
    class="mt-tight w-full rounded-panel border border-default p-small"
    data-testid="agent-roll-preview"
  >
    <strong>{{ summary.name }}</strong
    ><span v-if="action.targetLabel"> → {{ action.targetLabel }}</span>
    <div class="flex flex-wrap items-center gap-tight">
      <DieIcon v-for="(size, i) in summary.sizes" :key="i" :sides="size" class="!size-3.5" />
      <span>{{ summary.formula }}</span>
    </div>
    <div class="mt-tight flex items-center justify-between gap-small">
      <UCheckbox
        v-model="privateRoll"
        label="Private roll"
        data-testid="agent-roll-private"
        :disabled="submitting"
      />
      <UButton size="xs" data-testid="agent-make-roll" :loading="submitting" @click="makeRoll"
        >Make a roll</UButton
      >
    </div>
  </div>
</template>
