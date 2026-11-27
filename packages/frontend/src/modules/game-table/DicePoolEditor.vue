<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { computed } from "vue";
import DieButton from "../../shared/design-system/domain/DieButton.vue";

const props = withDefaults(
  defineProps<{
    sizes: readonly number[];
    opposing?: boolean;
    showPool?: boolean;
    opposingDice?: readonly number[];
    hasPoolPrefix?: boolean;
  }>(),
  { showPool: true },
);

const dice = defineModel<number[]>("dice", { required: true });
const modifier = defineModel<string>("modifier", { required: true });
const emit = defineEmits<{ removeOpposing: [index: number] }>();
const full = computed(() => dice.value.length >= 2);

function add(size: number) {
  if (!full.value) dice.value = [...dice.value, size];
}

function remove(index: number) {
  dice.value = dice.value.filter((_, dieIndex) => dieIndex !== index);
}
</script>

<template>
  <div :class="opposing ? 'space-y-small' : 'space-y-medium'">
    <p class="text-small font-medium">
      {{ opposing ? tr("ui.opposingDice") : tr("ui.friendlyDice") }}
    </p>
    <div
      class="flex flex-wrap items-center gap-small"
      :aria-label="opposing ? undefined : tr('ui.addDiceAndModifier')"
    >
      <UTooltip
        v-for="size in sizes"
        :key="size"
        :text="tr('ui.maximum2Dice')"
        :disabled="!full"
        :content="{ side: 'top' }"
      >
        <span class="dice-trigger" :class="{ opposing }" :tabindex="full ? 0 : undefined">
          <DieButton
            :sides="size"
            :opposing="opposing"
            :disabled="full"
            :data-testid="opposing ? `opponent-add-d${size}` : `add-die-d${size}`"
            :aria-label="
              opposing
                ? tr('ui.addOpposingDValue1', { value1: size })
                : tr('ui.addDValue1ToDicePool', { value1: size })
            "
            @click="add(size)"
          />
        </span>
      </UTooltip>
      <label class="modifier-card" :class="{ opposing }">
        <span>{{ tr("ui.modifier") }}</span>
        <input
          :value="modifier"
          type="number"
          step="1"
          :data-testid="opposing ? 'opponent-modifier' : 'free-modifier'"
          @input="modifier = ($event.target as HTMLInputElement).value"
        />
      </label>
    </div>
    <slot />
    <div v-if="showPool">
      <p class="mb-small text-small font-medium">{{ tr("ui.dicePool") }}</p>
      <div
        v-if="dice.length || opposingDice?.length || hasPoolPrefix"
        class="flex flex-wrap gap-small"
      >
        <slot name="pool-prefix" />
        <DieButton
          v-for="(size, index) in dice"
          :key="`pool-${index}`"
          :sides="size"
          :opposing="opposing"
          :data-testid="opposing ? `opponent-pool-d${size}` : `pool-die-d${size}`"
          :aria-label="
            opposing
              ? tr('ui.removeOpposingDValue1', { value1: size })
              : tr('ui.removeDValue1FromDicePool', { value1: size })
          "
          @click="remove(index)"
        />
        <DieButton
          v-for="(size, index) in opposingDice"
          :key="`opponent-${index}`"
          :sides="size"
          opposing
          :data-testid="`opponent-pool-d${size}`"
          :aria-label="tr('ui.removeOpposingDValue1FromDicePool', { value1: size })"
          @click="emit('removeOpposing', index)"
        />
      </div>
      <p v-else class="text-small text-muted" :data-testid="opposing ? undefined : 'pool-empty'">
        {{ tr("ui.selectDiceToAddThemToThePool") }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.dice-trigger {
  display: inline-flex;
}
.dice-trigger button:disabled {
  pointer-events: none;
}
.dice-trigger:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  border-radius: var(--radius-panel);
}
.dice-trigger.opposing:focus-visible {
  outline-color: var(--ui-error);
}
.modifier-card {
  min-height: 2.75rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--dice-control-gap);
  padding: var(--dice-control-padding);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  font-size: var(--dice-label-size);
  font-weight: 700;
}
.modifier-card.opposing {
  min-height: auto;
  min-width: 2.75rem;
}
.modifier-card input {
  width: 3rem;
  min-width: 0;
  appearance: textfield;
  text-align: center;
  color: var(--ui-text-highlighted);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-control);
  background: var(--ui-bg);
}
.modifier-card input::-webkit-inner-spin-button,
.modifier-card input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}
</style>
