<script setup lang="ts">
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";
import type { HistoryTurn } from "./types";
defineProps<{ roll: NonNullable<HistoryTurn["roll"]> }>();
</script>
<template>
  <div
    class="mt-tight w-full rounded-panel border border-default px-small py-tight"
    data-testid="agent-roll-result"
  >
    <strong>{{ roll.characterName }}</strong
    ><span v-if="roll.equipmentName"> · {{ roll.equipmentName }}</span
    ><span v-if="roll.private"> · Private</span>
    <div v-for="(side, i) in [roll.outcome.first, roll.outcome.second].filter((s) => !!s)" :key="i">
      <span v-if="i">vs </span
      ><template v-for="(die, j) in side.dice" :key="j"
        >{{ j ? " + " : ""
        }}<DieIcon :sides="die.size" class="inline-block !size-3.5 align-text-bottom" />
        {{ die.label ? die.label + " " : "" }}d{{ die.size }} (<span
          data-testid="agent-roll-face"
          >{{ die.face }}</span
        >)</template
      >
      <span v-if="side.modifier">
        {{ side.modifier > 0 ? "+" : "−" }} {{ Math.abs(side.modifier) }}</span
      >
      = <strong data-testid="agent-roll-total">{{ side.total }}</strong
      ><span v-if="side.result === 'critical' || side.result === 'fumble'">
        · {{ side.result }}</span
      >
    </div>
  </div>
</template>
