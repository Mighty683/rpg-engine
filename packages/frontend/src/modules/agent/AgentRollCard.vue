<script setup lang="ts">
import { tr } from "../../shared/i18n";
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";
import { ref } from "vue";
import type { RollPreview } from "./types";

const props = defineProps<{
  summary: RollPreview;
  targetLabel?: string;
  initiallyPrivate: boolean;
  submitting: boolean;
  onRoll(privateRoll: boolean): Promise<void>;
}>();
const privateRoll = ref(props.initiallyPrivate);
</script>
<template>
  <div
    class="mt-tight w-full rounded-panel border border-default p-small"
    data-testid="agent-roll-preview"
  >
    <strong>{{ summary.name }}</strong
    ><span v-if="targetLabel"> → {{ targetLabel }}</span>
    <div class="flex flex-wrap items-center gap-tight">
      <DieIcon v-for="(size, i) in summary.sizes" :key="i" :sides="size" class="!size-3.5" />
      <span>{{ summary.formula }}</span>
    </div>
    <div class="mt-tight flex items-center justify-between gap-small">
      <UCheckbox
        v-model="privateRoll"
        :label="tr('ui.privateRoll')"
        data-testid="agent-roll-private"
        :disabled="submitting"
      />
      <UButton
        size="xs"
        data-testid="agent-make-roll"
        :loading="submitting"
        @click="onRoll(privateRoll)"
        >{{ tr("ui.makeARoll") }}</UButton
      >
    </div>
  </div>
</template>
