<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import FreeBenefitsEditor from "./FreeBenefitsEditor.vue";
import type { BenefitDraft, SkillDraft } from "./types";

defineProps<{ skills: SkillDraft[]; removeDisabled?: boolean; readOnly?: boolean }>();
const emit = defineEmits<{
  add: [];
  update: [id: string, change: Partial<SkillDraft>];
  remove: [id: string];
  addBenefit: [id: string, name: string];
}>();
function updateBenefit(skill: SkillDraft, id: string, change: Partial<BenefitDraft>) {
  emit("update", skill.id, {
    benefits: skill.benefits.map((benefit) =>
      benefit.id === id ? { ...benefit, ...change } : benefit,
    ),
  });
}
function removeBenefit(skill: SkillDraft, id: string) {
  emit("update", skill.id, { benefits: skill.benefits.filter((benefit) => benefit.id !== id) });
}
</script>

<template>
  <SurfaceCard>
    <h2 class="text-section font-semibold">{{ tr("ui.skills2") }}</h2>
    <p v-if="!readOnly" class="text-muted">
      {{ tr("ui.defineEachSkillSDescriptionRankLimitAndBenefits") }}
    </p>
    <p v-if="skills.length === 0" class="mt-medium text-muted" data-testid="skills-empty">
      {{ tr("ui.noSkillsAddedYet") }}
    </p>
    <div class="mt-medium flex flex-col gap-medium">
      <article
        v-for="(skill, index) in skills"
        :key="skill.id"
        :data-testid="`skill-${skill.id}`"
        class="rounded-panel border border-accented bg-default p-medium"
      >
        <div class="flex flex-wrap items-end justify-between gap-medium">
          <LabeledInput
            :readonly="readOnly"
            :label="tr('ui.skillName')"
            class="w-64 max-w-full"
            :model-value="skill.name"
            :data-testid="`skill-name-${skill.id}`"
            @update:model-value="emit('update', skill.id, { name: String($event) })"
          />
          <UButton
            v-if="!readOnly"
            color="error"
            variant="outline"
            :disabled="removeDisabled"
            :aria-label="tr('ui.removeSkillValue1', { value1: skill.name || index + 1 })"
            :data-testid="`remove-skill-${skill.id}`"
            @click="emit('remove', skill.id)"
            >{{ tr("ui.removeSkill") }}</UButton
          >
        </div>
        <LabeledInput
          :readonly="readOnly"
          class="mt-small"
          :label="tr('ui.description')"
          multiline
          :rows="3"
          :model-value="skill.description"
          :data-testid="`skill-description-${skill.id}`"
          @update:model-value="emit('update', skill.id, { description: String($event) })"
        />
        <LabeledInput
          :readonly="readOnly"
          class="mt-small w-32"
          :label="tr('ui.maximumRank')"
          type="number"
          min="1"
          step="1"
          :hint="tr('ui.use1ForASinglePurchaseSkill')"
          :model-value="skill.maxRank"
          :data-testid="`skill-rank-${skill.id}`"
          @update:model-value="emit('update', skill.id, { maxRank: String($event) })"
        />
        <FreeBenefitsEditor
          class="mt-medium"
          :title="tr('ui.skillBenefits')"
          allow-rank-scaling
          :description="tr('ui.addEffectsAndChooseWhetherStatModifiersScaleWith')"
          :benefits="skill.benefits"
          :read-only="readOnly"
          @add="emit('addBenefit', skill.id, $event)"
          @update="(id, change) => updateBenefit(skill, id, change)"
          @remove="removeBenefit(skill, $event)"
        />
      </article>
    </div>
    <UButton
      v-if="!readOnly"
      class="mt-medium"
      color="primary"
      variant="solid"
      data-testid="add-skill"
      @click="emit('add')"
      >{{ tr("ui.addSkill") }}</UButton
    >
  </SurfaceCard>
</template>
