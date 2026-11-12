<script setup lang="ts">
import type { ThrowRecord } from "./types";
import DieIcon from "../../shared/design-system/DieIcon.vue";

defineProps<{ entry: ThrowRecord; highlighted?: boolean }>();
defineEmits<{ reroll: []; remove: [] }>();

const kindLabel: Record<ThrowRecord["kind"], string> = {
  "attribute-check": "Attribute check",
  "attribute-roll": "Attribute roll",
  "weapon-accuracy": "Weapon accuracy",
  free: "Dice roll",
  "opposed-check": "Opposed check",
  "opposed-roll": "Opposed roll",
};

const resultLabel = { fumble: "Fumble", critical: "Critical success", ordinary: "", none: "" };

function title(entry: ThrowRecord) {
  const actor =
    entry.setup.type === "npc-attribute" || entry.setup.type === "npc-attack" || entry.setup.npcId
      ? `GM · ${entry.characterName}`
      : entry.characterId
        ? `${entry.role} · ${entry.characterName}`
        : entry.role === "GM"
          ? "GM"
          : entry.characterName;
  return [actor, entry.equipmentName ?? kindLabel[entry.kind]].filter(Boolean).join(" · ");
}
function outcomeText(entry: ThrowRecord) {
  if (!entry.outcome.second || !entry.outcome.winner) return "";
  return entry.outcome.winner === "tie"
    ? "Tie — reroll"
    : `${entry.outcome.winner === "first" ? entry.characterName : "Opponent"} wins`;
}
function dieLabel(die: { label: string | null; size: number }) {
  return die.label ?? `d${die.size}`;
}
</script>

<template>
  <li
    class="rounded-panel border border-default p-small"
    :class="{ 'throw-highlight': highlighted }"
    data-testid="throw-entry"
    :data-throw-id="entry.id"
  >
    <div class="flex items-start justify-between gap-small">
      <p class="font-semibold" data-testid="throw-title">{{ title(entry) }}</p>
      <div class="flex items-center gap-tight">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :data-testid="`reroll-throw`"
          :aria-label="`Reroll ${title(entry)}`"
          @click="$emit('reroll')"
          >Reroll</UButton
        >
        <UButton
          v-if="entry.canRemove"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :data-testid="`remove-throw`"
          :aria-label="`Remove ${title(entry)} throw`"
          @click="$emit('remove')"
        />
      </div>
    </div>
    <div
      class="throw-dice"
      :aria-label="
        [
          ...entry.outcome.first.dice.map((die) => `${dieLabel(die)} d${die.size}: ${die.face}`),
          ...(entry.outcome.first.modifier ? [`modifier ${entry.outcome.first.modifier}`] : []),
          ...(entry.outcome.second
            ? [
                'opponent: ' +
                  entry.outcome.second.dice
                    .map((die) => `${dieLabel(die)} d${die.size}: ${die.face}`)
                    .join(', ') +
                  (entry.outcome.second.modifier
                    ? `; modifier ${entry.outcome.second.modifier}`
                    : ''),
              ]
            : []),
        ].join('; ')
      "
    >
      <span
        v-for="(die, dieIndex) in entry.outcome.first.dice"
        :key="dieIndex"
        class="throw-die"
        aria-hidden="true"
      >
        <span class="throw-die-symbol"
          ><span class="throw-die-label">{{ dieLabel(die) }}</span
          ><DieIcon :sides="die.size"
        /></span>
        <span class="die-face">{{ die.face }}</span>
      </span>
      <strong
        v-if="entry.outcome.first.modifier !== 0"
        class="text-sm text-highlighted"
        data-testid="throw-modifier"
        >{{ entry.outcome.first.modifier < 0 ? "−" : "+" }}
        {{ Math.abs(entry.outcome.first.modifier) }}</strong
      >
      <template v-if="entry.outcome.second">
        <span class="text-sm text-muted" aria-hidden="true">vs</span>
        <span
          v-for="(die, dieIndex) in entry.outcome.second.dice"
          :key="`opponent-${dieIndex}`"
          class="throw-die opponent-die-result"
          aria-hidden="true"
        >
          <span class="throw-die-symbol"
            ><span class="throw-die-label">{{ dieLabel(die) }}</span
            ><DieIcon :sides="die.size" /></span
          ><span class="die-face">{{ die.face }}</span>
        </span>
        <strong
          v-if="entry.outcome.second.modifier !== 0"
          class="text-sm"
          data-testid="throw-opponent-modifier"
          >{{ entry.outcome.second.modifier < 0 ? "−" : "+" }}
          {{ Math.abs(entry.outcome.second.modifier) }}</strong
        >
      </template>
    </div>
    <p data-testid="throw-result">
      {{ entry.kind === "weapon-accuracy" ? "Accuracy" : "Total" }}:
      <strong>{{ entry.outcome.first.total }}</strong
      ><span v-if="resultLabel[entry.outcome.first.result]">
        ({{ resultLabel[entry.outcome.first.result] }})</span
      ><template v-if="entry.outcome.second">
        vs <strong>{{ entry.outcome.second.total }}</strong
        ><span v-if="resultLabel[entry.outcome.second.result]">
          ({{ resultLabel[entry.outcome.second.result] }})</span
        >
        · <span data-testid="throw-outcome">{{ outcomeText(entry) }}</span></template
      >
    </p>
    <p v-if="entry.setup.note" class="text-sm text-muted" data-testid="throw-note">
      {{ entry.setup.note }}
    </p>
  </li>
</template>

<style scoped>
.opponent-die-result :deep(.die-icon) {
  color: var(--ui-error);
}
.throw-highlight {
  animation: new-throw 1s ease-out;
}
@keyframes new-throw {
  0% {
    transform: scale(0.97);
    border-color: var(--ui-primary);
    background: var(--ui-bg-elevated);
  }
  35% {
    transform: scale(1);
    border-color: var(--ui-primary);
    background: var(--ui-bg-elevated);
  }
  60% {
    transform: scale(0.99);
  }
  100% {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .throw-highlight {
    animation: none;
    border-color: var(--ui-primary);
    background: var(--ui-bg-elevated);
  }
}
.throw-dice,
.throw-die {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.throw-dice {
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.375rem 0;
}
.throw-die :deep(.die-icon) {
  width: 1.25rem;
  height: 1.25rem;
}
.throw-die-symbol {
  display: grid;
  justify-items: center;
  gap: 0.125rem;
}
.throw-die-label {
  color: var(--ui-text-muted);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
}
.die-face {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.6rem;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg-elevated);
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  font-weight: 700;
  font-size: 0.875rem;
}
</style>
