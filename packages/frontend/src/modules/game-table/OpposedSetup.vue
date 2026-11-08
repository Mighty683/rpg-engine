<script setup lang="ts">
import type { OpponentDraft } from "./types";
import DicePoolEditor from "./DicePoolEditor.vue";


const props = withDefaults(defineProps<{ sizes?: readonly number[]; showPool?: boolean }>(), {
  sizes: () => [6, 8, 10, 12],
  showPool: true,
});
const opponent = defineModel<OpponentDraft>({ required: true });
</script>

<template>
  <DicePoolEditor
    class="opposed-setup"
    :dice="opponent.dice"
    :modifier="opponent.modifier"
    :sizes="props.sizes"
    :show-pool="props.showPool"
    opposing
    @update:dice="opponent = { ...opponent, dice: $event }"
    @update:modifier="opponent = { ...opponent, modifier: $event }"
  />
</template>

<style scoped>
.opposed-setup {
  border-top: 1px solid var(--ui-border);
  padding-top: var(--spacing-small);
}
</style>
