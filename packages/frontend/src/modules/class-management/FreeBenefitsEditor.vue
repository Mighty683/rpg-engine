<script setup lang="ts">
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import { ref } from "vue";
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import type { BenefitDraft } from "./types";

defineProps<{ benefits: BenefitDraft[] }>();
const emit = defineEmits<{
  add: [name: string];
  remove: [id: number];
  update: [id: number, change: Partial<BenefitDraft>];
}>();
const newName = ref("");
function addBenefit() {
  const name = newName.value.trim();
  if (!name) return;
  emit("add", name);
  newName.value = "";
}
const types = [
  { label: "Text effect", value: "text" },
  { label: "Stat modifier", value: "modifier" },
];
const stats = [
  { label: "Maximum HP", value: "maxHp" },
  { label: "Maximum MP", value: "maxMp" },
  { label: "Maximum IP", value: "maxIp" },
  { label: "Defense", value: "defense" },
  { label: "Magic Defense", value: "magicDefense" },
  { label: "DEX die", value: "dieDex" },
  { label: "INS die", value: "dieIns" },
  { label: "MIG die", value: "dieMig" },
  { label: "WLP die", value: "dieWlp" },
];
</script>

<template>
  <SurfaceCard>
    <div class="flex flex-wrap items-start justify-between gap-medium">
      <div>
        <h2 class="text-section font-semibold">Free benefits</h2>
        <p class="text-muted">Granted once when the class is acquired.</p>
      </div>
    </div>
    <p v-if="benefits.length === 0" class="mt-medium text-muted">
      No benefits added yet. Add a text effect or a stat modifier.
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
            label="Benefit name"
            class="w-64 max-w-full"
            :model-value="benefit.name"
            :data-testid="`benefit-name-${benefit.id}`"
            @update:model-value="emit('update', benefit.id, { name: String($event) })"
          />
          <UButton
            color="error"
            variant="outline"
            size="sm"
            :aria-label="`Remove benefit ${index + 1}`"
            :data-testid="`remove-benefit-${benefit.id}`"
            @click="emit('remove', benefit.id)"
            >Remove</UButton
          >
        </div>
        <div class="mt-small flex flex-wrap items-end gap-medium">
          <LabeledSelect
            label="Type"
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
              label="Stat"
              :model-value="benefit.stat || undefined"
              :items="stats"
              placeholder="Select a stat"
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
              :label="benefit.stat.startsWith('die') ? 'Die steps' : 'Modifier'"
              type="number"
              class="w-24"
              :model-value="benefit.amount"
              :placeholder="benefit.stat.startsWith('die') ? 'e.g. 1' : 'e.g. 5'"
              :data-testid="`benefit-amount-${benefit.id}`"
              @update:model-value="emit('update', benefit.id, { amount: String($event) })"
            />
          </template>
        </div>
        <LabeledInput
          :label="benefit.kind === 'text' ? 'Effect' : 'Description'"
          multiline
          :rows="2"
          class="mt-small"
          :model-value="benefit.description"
          placeholder="Describe the effect"
          :data-testid="`benefit-description-${benefit.id}`"
          @update:model-value="emit('update', benefit.id, { description: String($event) })"
        />
        <p v-if="benefit.kind === 'text'" class="mt-small text-muted">
          Text effects are interpreted during play.
        </p>
        <p v-else-if="benefit.stat.startsWith('die')" class="mt-small text-muted">
          Enter die steps: +1 changes a d8 to a d10; −1 changes a d8 to a d6. Dice stay between d6
          and d12.
        </p>
      </article>
    </div>
    <form class="mt-medium flex flex-wrap items-end gap-small" @submit.prevent="addBenefit">
      <LabeledInput
        v-model="newName"
        label="Benefit name"
        placeholder="Name the benefit"
        class="w-64 max-w-full"
        data-testid="new-benefit-name"
        required
      />
      <UButton type="submit" color="primary" variant="outline" data-testid="add-benefit"
        >Add benefit</UButton
      >
    </form>
  </SurfaceCard>
</template>
