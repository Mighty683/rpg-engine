<script setup lang="ts">
import SurfaceCard from "../../shared/design-system/base/SurfaceCard.vue";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import FreeBenefitsEditor from "./FreeBenefitsEditor.vue";
import type { BenefitDraft, SkillDraft } from "./types";

defineProps<{ skills: SkillDraft[]; removeDisabled?: boolean }>();
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
    <h2 class="text-section font-semibold">Skills</h2>
    <p class="text-muted">Define each skill's description, rank limit and benefits.</p>
    <p v-if="skills.length === 0" class="mt-medium text-muted" data-testid="skills-empty">
      No skills added yet.
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
            label="Skill name"
            class="w-64 max-w-full"
            :model-value="skill.name"
            :data-testid="`skill-name-${skill.id}`"
            @update:model-value="emit('update', skill.id, { name: String($event) })"
          />
          <UButton
            color="error"
            variant="outline"
            :disabled="removeDisabled"
            :aria-label="`Remove skill ${skill.name || index + 1}`"
            :data-testid="`remove-skill-${skill.id}`"
            @click="emit('remove', skill.id)"
            >Remove skill</UButton
          >
        </div>
        <LabeledInput
          class="mt-small"
          label="Description"
          multiline
          :rows="3"
          :model-value="skill.description"
          :data-testid="`skill-description-${skill.id}`"
          @update:model-value="emit('update', skill.id, { description: String($event) })"
        />
        <LabeledInput
          class="mt-small w-32"
          label="Maximum rank"
          type="number"
          min="1"
          step="1"
          hint="Use 1 for a single-purchase skill."
          :model-value="skill.maxRank"
          :data-testid="`skill-rank-${skill.id}`"
          @update:model-value="emit('update', skill.id, { maxRank: String($event) })"
        />
        <FreeBenefitsEditor
          class="mt-medium"
          title="Skill benefits"
          allow-rank-scaling
          description="Add effects and choose whether stat modifiers scale with rank."
          :benefits="skill.benefits"
          @add="emit('addBenefit', skill.id, $event)"
          @update="(id, change) => updateBenefit(skill, id, change)"
          @remove="removeBenefit(skill, $event)"
        />
      </article>
    </div>
    <UButton
      class="mt-medium"
      color="primary"
      variant="solid"
      data-testid="add-skill"
      @click="emit('add')"
      >Add skill</UButton
    >
  </SurfaceCard>
</template>
