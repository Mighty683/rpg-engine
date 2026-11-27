<script setup lang="ts">
import { tr } from "../../shared/i18n";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import { ref } from "vue";
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import type { BenefitDraft } from "./types";
import { classModifierLabels, isDieModifier } from "../../shared/fabula/classModifiers";

withDefaults(
  defineProps<{
    benefits: BenefitDraft[];
    title?: string;
    description?: string;
    allowRankScaling?: boolean;
    readOnly?: boolean;
  }>(),
  {
    title: tr("ui.freeBenefits"),
    description: tr("ui.grantedOnceWhenTheClassIsAcquired"),
  },
);
const emit = defineEmits<{
  add: [name: string];
  remove: [id: string];
  update: [id: string, change: Partial<BenefitDraft>];
}>();
const newName = ref("");
function addBenefit() {
  const name = newName.value.trim();
  if (!name) return;
  emit("add", name);
  newName.value = "";
}
const types = [
  { label: tr("ui.textEffect"), value: "text" },
  { label: tr("ui.statModifier"), value: "modifier" },
];
const stats = Object.entries(classModifierLabels).map(([value, label]) => ({ label, value }));
</script>

<template>
  <SurfaceCard>
    <div class="flex flex-wrap items-start justify-between gap-medium">
      <div>
        <h2 class="text-section font-semibold">{{ title }}</h2>
        <p class="text-muted">{{ description }}</p>
      </div>
    </div>
    <p v-if="benefits.length === 0" class="mt-medium text-muted">
      {{ tr(readOnly ? "ui.emptyBenefits" : "ui.emptyEditableBenefits") }}
    </p>
    <div v-else class="mt-medium flex flex-col gap-small">
      <article
        v-for="(benefit, index) in benefits"
        :key="benefit.id"
        class="rounded-panel border border-accented bg-default p-medium"
        :data-testid="`benefit-${benefit.id}`"
      >
        <div class="flex items-center justify-between gap-small">
          <LabeledInput
            :readonly="readOnly"
            :label="tr('ui.benefitName')"
            class="w-64 max-w-full"
            :model-value="benefit.name"
            :data-testid="`benefit-name-${benefit.id}`"
            @update:model-value="emit('update', benefit.id, { name: String($event) })"
          />
          <UButton
            v-if="!readOnly"
            color="error"
            variant="outline"
            size="sm"
            :aria-label="tr('ui.removeBenefitValue1', { value1: index + 1 })"
            :data-testid="`remove-benefit-${benefit.id}`"
            @click="emit('remove', benefit.id)"
            >{{ tr("ui.remove") }}</UButton
          >
        </div>
        <div class="mt-small flex flex-wrap items-end gap-medium">
          <LabeledSelect
            :disabled="readOnly"
            :label="tr('ui.type')"
            :model-value="benefit.kind"
            :items="types"
            size="md"
            class="w-44 max-w-full"
            :data-testid="`benefit-kind-${benefit.id}`"
            @update:model-value="
              emit('update', benefit.id, { kind: $event as BenefitDraft['kind'] })
            "
          >
            <template #item-label="{ item }"
              ><span :data-testid="`benefit-kind-option-${item.value}`">{{
                item.label
              }}</span></template
            >
          </LabeledSelect>
          <template v-if="benefit.kind === 'modifier'">
            <LabeledSelect
              :disabled="readOnly"
              :label="tr('ui.stat')"
              :model-value="benefit.stat || undefined"
              :items="stats"
              :placeholder="tr('ui.selectAStat')"
              size="md"
              class="w-44 max-w-full"
              :data-testid="`benefit-stat-${benefit.id}`"
              @update:model-value="emit('update', benefit.id, { stat: String($event) })"
            >
              <template #item-label="{ item }"
                ><span :data-testid="`benefit-stat-option-${item.value}`">{{
                  item.label
                }}</span></template
              >
            </LabeledSelect>
            <LabeledInput
              :readonly="readOnly"
              :label="isDieModifier(benefit.stat) ? tr('ui.dieSteps') : tr('ui.modifier')"
              type="number"
              class="w-24"
              :model-value="benefit.amount"
              :placeholder="tr('ui.exampleNumber', { number: isDieModifier(benefit.stat) ? 1 : 5 })"
              :data-testid="`benefit-amount-${benefit.id}`"
              @update:model-value="emit('update', benefit.id, { amount: String($event) })"
            />
            <UCheckbox
              v-if="allowRankScaling"
              :disabled="readOnly"
              :label="tr('ui.applyPerRank')"
              :model-value="benefit.perRank ?? false"
              @update:model-value="emit('update', benefit.id, { perRank: $event === true })"
            />
          </template>
        </div>
        <LabeledInput
          :readonly="readOnly"
          :label="benefit.kind === 'text' ? tr('ui.effect') : tr('ui.description')"
          multiline
          :rows="2"
          class="mt-small"
          :model-value="benefit.description"
          :placeholder="tr('ui.describeTheEffect')"
          :data-testid="`benefit-description-${benefit.id}`"
          @update:model-value="emit('update', benefit.id, { description: String($event) })"
        />
        <p v-if="benefit.kind === 'text'" class="mt-small text-muted">
          {{ tr("ui.textEffectsAreInterpretedDuringPlay") }}
        </p>
        <p v-else-if="isDieModifier(benefit.stat)" class="mt-small text-muted">
          {{ tr("ui.enterDieSteps1ChangesAD8ToA") }}
        </p>
      </article>
    </div>
    <form
      v-if="!readOnly"
      class="mt-medium flex flex-wrap items-end gap-small"
      @submit.prevent="addBenefit"
    >
      <LabeledInput
        v-model="newName"
        :label="tr('ui.benefitName')"
        :placeholder="tr('ui.nameTheBenefit')"
        class="w-64 max-w-full"
        data-testid="new-benefit-name"
        required
      />
      <UButton type="submit" color="neutral" variant="outline" data-testid="add-benefit">{{
        tr("ui.addBenefit")
      }}</UButton>
    </form>
  </SurfaceCard>
</template>
