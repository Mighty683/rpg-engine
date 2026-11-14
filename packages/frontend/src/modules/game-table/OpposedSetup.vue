<script setup lang="ts">
import type { OpponentDraft } from "./types";
import DicePoolEditor from "./DicePoolEditor.vue";
import DieIcon from "../../shared/design-system/domain/DieIcon.vue";

const props = withDefaults(
  defineProps<{
    sizes?: readonly number[];
    showPool?: boolean;
    friendlyDice?: readonly number[];
  }>(),
  {
    sizes: () => [6, 8, 10, 12],
    showPool: true,
  },
);
const opponent = defineModel<OpponentDraft>({ required: true });
</script>

<template>
  <DicePoolEditor
    class="opposed-setup"
    :dice="opponent.dice"
    :modifier="opponent.modifier"
    :sizes="props.sizes"
    :show-pool="props.showPool"
    :has-pool-prefix="!!friendlyDice?.length"
    opposing
    @update:dice="opponent = { ...opponent, dice: $event }"
    @update:modifier="opponent = { ...opponent, modifier: $event }"
  >
    <template #pool-prefix>
      <span
        v-for="(size, index) in friendlyDice"
        :key="index"
        class="friendly-die"
        :aria-label="`Friendly d${size}`"
      >
        <DieIcon :sides="size" /><span>d{{ size }}</span>
      </span>
    </template>
  </DicePoolEditor>
</template>

<style scoped>
.opposed-setup {
  border-top: 1px solid var(--ui-border);
  padding-top: var(--spacing-small);
}
.friendly-die {
  min-width: 2.75rem;
  display: grid;
  justify-items: center;
  gap: var(--dice-control-gap);
  padding: var(--dice-control-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--dice-label-size);
  font-weight: 700;
}
.friendly-die :deep(.die-icon) {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
