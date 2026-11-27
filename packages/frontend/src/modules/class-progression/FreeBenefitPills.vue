<script setup lang="ts">
import { tr } from "../../shared/i18n";
import { classModifierLabels, isDieModifier } from "../../shared/fabula/classModifiers";
import type { ProgressionBenefit } from "./types";
defineProps<{ benefits: ProgressionBenefit[] }>();
</script>
<template>
  <ul class="flex flex-wrap items-start gap-small">
    <li v-for="benefit in benefits" :key="benefit.id">
      <UBadge v-if="benefit.stat" color="primary" variant="subtle" class="rounded-full">
        {{ benefit.name }} · {{ classModifierLabels[benefit.stat] }}
        {{ (benefit.amount ?? 0) >= 0 ? "+" : "" }}{{ benefit.amount ?? 0
        }}{{ isDieModifier(benefit.stat) ? " " + tr("ui.dieStepsUnit") : "" }}
      </UBadge>
      <UPopover v-else>
        <UButton
          color="neutral"
          variant="subtle"
          size="xs"
          class="rounded-full"
          :data-testid="`free-benefit-${benefit.id}`"
          >{{ benefit.name }}</UButton
        >
        <template #content>
          <p
            class="max-w-xs p-small text-small"
            :data-testid="`free-benefit-description-${benefit.id}`"
          >
            {{ benefit.description }}
          </p>
        </template>
      </UPopover>
    </li>
  </ul>
</template>
