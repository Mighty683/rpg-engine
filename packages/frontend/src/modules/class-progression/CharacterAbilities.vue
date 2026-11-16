<script setup lang="ts">
import { computed, ref } from "vue";
import ProgressActionButton from "../../shared/design-system/base/ProgressActionButton.vue";
import SegmentedProgress from "../../shared/design-system/base/SegmentedProgress.vue";
import ScreenSection from "../../shared/design-system/base/ScreenSection.vue";
import FreeBenefitPills from "./FreeBenefitPills.vue";
import ClassAbilitiesContent from "./ClassAbilitiesContent.vue";
import type { ProgressionClass, ManagedAbilities } from "./types";
import { assignedRanks, CLASS_LEVEL_EXP_COST, MAX_CHARACTER_CLASSES, totalRanks } from "./model";
const props = defineProps<{
  catalog: ProgressionClass[];
  character: ManagedAbilities;
  expanded?: boolean;
  readOnly?: boolean;
  saving?: boolean;
  levels?: Record<string, number>;
}>();
const emit = defineEmits<{
  changeClass: [id: string, delta: number];
  changeSkill: [id: string, delta: number];
}>();
const classPickerOpen = ref(false);
function level(entry: ProgressionClass) {
  return props.levels?.[entry.id] ?? props.character.levels[entry.id] ?? 0;
}
const available = computed(() =>
  props.catalog.filter((entry) => !level(entry) && !assignedRanks(entry, props.character.ranks)),
);
const acquired = computed(() =>
  props.catalog.filter((entry) => level(entry) || assignedRanks(entry, props.character.ranks)),
);
const currentLevels = computed(() => props.levels ?? props.character.levels);
const classAllocationAtCap = computed(() => totalRanks(currentLevels.value) >= 50);
const needsExperience = computed(() => props.character.experience.current < CLASS_LEVEL_EXP_COST);
const experienceRequired = `You need ${CLASS_LEVEL_EXP_COST} current EXP to add a class level.`;
const addClassReason = computed(() => {
  if (props.saving) return "Wait for the current change to save.";
  if (acquired.value.length >= MAX_CHARACTER_CLASSES)
    return `A character can have up to ${MAX_CHARACTER_CLASSES} classes.`;
  if (!available.value.length) return "No more classes are available.";
  if (classAllocationAtCap.value) return "All 50 class levels are assigned.";
  if (needsExperience.value) return experienceRequired;
});
function increaseReason(entry: ProgressionClass) {
  if (level(entry) >= 10) return "This class is at level 10.";
  if (classAllocationAtCap.value) return "All 50 class levels are assigned.";
  if (needsExperience.value) return experienceRequired;
}
function decreaseReason(entry: ProgressionClass) {
  if (level(entry) <= assignedRanks(entry, props.character.ranks))
    return "Lower a skill rank in this class before lowering its level.";
}
function addClass(id: string) {
  emit("changeClass", id, 1);
  classPickerOpen.value = false;
}
</script>
<template>
  <ScreenSection class="space-y-small" data-testid="sheet-abilities">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h2 class="text-section font-semibold">Classes & skills</h2>
    </div>
    <template v-for="entry in acquired" :key="entry.id">
      <article
        v-if="expanded"
        class="rounded-panel border border-default bg-default p-small"
        :data-testid="`class-card-${entry.id}`"
      >
        <h3 class="text-label font-semibold" :data-testid="`class-summary-${entry.id}`">
          {{ entry.name }}
        </h3>
        <SegmentedProgress
          class="mt-small"
          :value="level(entry)"
          :maximum="10"
          :label="`${entry.name} level`"
          :data-testid="`class-progress-${entry.id}`"
          :editable="!readOnly"
          :disabled="saving"
          :decrease-blocked-reason="decreaseReason(entry)"
          :increase-blocked-reason="increaseReason(entry)"
          @increase="emit('changeClass', entry.id, 1)"
          @decrease="emit('changeClass', entry.id, -1)"
        />
        <p v-if="level(entry) === 10" class="text-small text-muted">Mastered</p>
        <ClassAbilitiesContent
          :entry="entry"
          :character="character"
          :editable="!readOnly"
          :saving="saving"
          :level="level(entry)"
          @change-skill="(id, delta) => emit('changeSkill', id, delta)"
        />
      </article>
      <details
        v-else
        class="rounded-panel border border-default bg-default p-small"
        :data-testid="`class-card-${entry.id}`"
      >
        <summary
          class="cursor-pointer text-label font-semibold"
          :data-testid="`class-summary-${entry.id}`"
        >
          {{ entry.name }}
          <SegmentedProgress
            class="mt-small"
            :value="level(entry)"
            :maximum="10"
            :label="`${entry.name} level`"
            :data-testid="`class-progress-${entry.id}`"
            :editable="!readOnly"
            :disabled="saving"
            :decrease-blocked-reason="decreaseReason(entry)"
            :increase-blocked-reason="increaseReason(entry)"
            @increase="emit('changeClass', entry.id, 1)"
            @decrease="emit('changeClass', entry.id, -1)"
          />
        </summary>
        <p v-if="level(entry) === 10" class="text-small text-muted">Mastered</p>
        <ClassAbilitiesContent
          :entry="entry"
          :character="character"
          :editable="!readOnly"
          :saving="saving"
          :level="level(entry)"
          @change-skill="(id, delta) => emit('changeSkill', id, delta)"
        />
      </details>
    </template>
    <ProgressActionButton
      v-if="!readOnly"
      block
      class="min-h-20 justify-center rounded-panel"
      :blocked-reason="addClassReason"
      data-testid="add-class"
      @click="classPickerOpen = true"
      >+ Add class</ProgressActionButton
    >
    <UModal
      v-model:open="classPickerOpen"
      title="Add class"
      description="Choose a class to add its first level."
    >
      <template #body>
        <div class="grid gap-small sm:grid-cols-2">
          <article
            v-for="entry in available"
            :key="entry.id"
            class="space-y-small rounded-panel border border-default bg-default p-medium"
          >
            <h3 class="font-semibold">{{ entry.name }}</h3>
            <p class="text-small text-muted">{{ entry.description }}</p>
            <details :data-testid="`preview-class-${entry.id}`">
              <summary class="cursor-pointer text-small">Preview benefits and skills</summary>
              <FreeBenefitPills
                v-if="entry.benefits.length"
                class="mt-small"
                :benefits="entry.benefits"
              />
              <ul class="mt-small space-y-small">
                <li
                  v-for="skill in entry.skills"
                  :key="skill.id"
                  class="rounded-panel bg-muted p-small"
                >
                  <strong>{{ skill.name }}</strong>
                  <p class="text-small">{{ skill.description }}</p>
                  <p class="text-small text-muted">Maximum rank {{ skill.maxRank }}</p>
                </li>
              </ul>
            </details>
            <ProgressActionButton
              :blocked-reason="addClassReason"
              :data-testid="`choose-class-${entry.id}`"
              @click="addClass(entry.id)"
              >Select {{ entry.name }}</ProgressActionButton
            >
          </article>
        </div>
      </template>
    </UModal>
  </ScreenSection>
</template>
