<script setup lang="ts">
import { computed, ref } from "vue";
import ProgressActionButton from "../../shared/design-system/base/ProgressActionButton.vue";
import SegmentedProgress from "../../shared/design-system/base/SegmentedProgress.vue";
import { totalRanks } from "./model";
import type { ProgressionClass, ManagedAbilities, ProgressionSkill } from "./types";
import FreeBenefitPills from "./FreeBenefitPills.vue";
const props = defineProps<{
  entry: ProgressionClass;
  character: ManagedAbilities;
  editable?: boolean;
  saving?: boolean;
  level?: number;
}>();
const emit = defineEmits<{ changeSkill: [id: string, delta: number] }>();
const pickerOpen = ref(false);
const available = computed(() =>
  props.entry.skills.filter((skill) => !props.character.ranks[skill.id]),
);
const assigned = computed(() =>
  props.entry.skills.reduce((sum, skill) => sum + (props.character.ranks[skill.id] ?? 0), 0),
);
const noCapacity = computed(() => assigned.value >= (props.level ?? assigned.value));
const capacityReason = computed(() => {
  if (!noCapacity.value) return;
  if ((props.level ?? 0) >= 10 || totalRanks(props.character.levels) >= 50)
    return "Lower another skill rank in this class to free up a rank.";
  return "Increase the class level or lower another skill rank to free up a rank.";
});
const addSkillReason = computed(() => {
  if (props.saving) return "Wait for the current change to save.";
  if (!props.entry.skills.length) return "This class has no skills.";
  if (!available.value.length) return "All skills in this class are already learned.";
});
function increaseReason(skill: ProgressionSkill) {
  if ((props.character.ranks[skill.id] ?? 0) >= skill.maxRank) return "Maximum rank reached.";
  return capacityReason.value;
}
function selectSkill(id: string) {
  emit("changeSkill", id, 1);
  pickerOpen.value = false;
}
const skills = computed(() =>
  props.entry.skills.filter((skill) => props.character.ranks[skill.id]),
);
</script>
<template>
  <div class="mt-small space-y-small">
    <FreeBenefitPills
      v-if="entry.benefits.length"
      :benefits="entry.benefits"
      :data-testid="`class-benefits-${entry.id}`"
    />
    <section v-if="skills.length || editable" :data-testid="`class-skills-${entry.id}`">
      <h4 class="mb-small text-label font-semibold">Skills</h4>
      <ul class="flex flex-wrap items-stretch gap-small">
        <li
          v-for="skill in skills"
          :key="skill.id"
          class="min-w-40 flex-1 rounded-panel border border-default bg-muted p-small"
        >
          <h5 class="text-label font-semibold" :data-testid="`acquired-${skill.id}`">
            {{ skill.name }}
          </h5>
          <SegmentedProgress
            class="mt-small"
            :value="character.ranks[skill.id] ?? 0"
            :maximum="Math.min(skill.maxRank, 10)"
            :label="`${skill.name} rank`"
            :data-testid="`skill-progress-${skill.id}`"
            :editable="editable"
            :disabled="saving"
            :increase-blocked-reason="increaseReason(skill)"
            @increase="emit('changeSkill', skill.id, 1)"
            @decrease="emit('changeSkill', skill.id, -1)"
          />
          <p class="mt-small text-small text-muted">{{ skill.description }}</p>
          <FreeBenefitPills
            v-if="skill.benefits.length"
            class="mt-small"
            :benefits="skill.benefits"
          />
        </li>
        <li v-if="editable">
          <ProgressActionButton
            size="sm"
            :blocked-reason="addSkillReason"
            :data-testid="`add-skill-${entry.id}`"
            @click="pickerOpen = true"
            >+ Add skill</ProgressActionButton
          >
        </li>
      </ul>
    </section>
    <UModal
      v-model:open="pickerOpen"
      :title="`Add a ${entry.name} skill`"
      description="Choose a skill card to assign one available class rank."
    >
      <template #body>
        <div class="grid gap-small sm:grid-cols-2">
          <ProgressActionButton
            v-for="skill in available"
            :key="skill.id"
            block
            class="flex-col items-start whitespace-normal p-medium text-left"
            :blocked-reason="addSkillReason ?? capacityReason"
            :data-testid="`select-skill-${skill.id}`"
            @click="selectSkill(skill.id)"
          >
            <strong>{{ skill.name }}</strong
            ><span class="text-small">{{ skill.description }}</span
            ><span class="text-small text-muted">Maximum rank {{ skill.maxRank }}</span>
          </ProgressActionButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
