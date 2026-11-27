<script setup lang="ts">
import { tr } from "../../shared/i18n";
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
const experienceRequired = tr("ui.youNeedValue1CurrentExpToAddAClass", {
  value1: CLASS_LEVEL_EXP_COST,
});
const addClassReason = computed(() => {
  if (props.saving) return tr("ui.waitForTheCurrentChangeToSave");
  if (acquired.value.length >= MAX_CHARACTER_CLASSES)
    return tr("ui.aCharacterCanHaveUpToValue1Classes", { value1: MAX_CHARACTER_CLASSES });
  if (!props.catalog.length) return tr("ui.noClassesAreAvailableInThisGame");
  if (!available.value.length) return tr("ui.noMoreClassesAreAvailable");
  if (classAllocationAtCap.value) return tr("ui.all50ClassLevelsAreAssigned");
  if (needsExperience.value) return experienceRequired;
});
function increaseReason(entry: ProgressionClass) {
  if (level(entry) >= 10) return tr("ui.thisClassIsAtLevel10");
  if (classAllocationAtCap.value) return tr("ui.all50ClassLevelsAreAssigned");
  if (needsExperience.value) return experienceRequired;
}
function decreaseReason(entry: ProgressionClass) {
  if (level(entry) <= assignedRanks(entry, props.character.ranks))
    return tr("ui.lowerASkillRankInThisClassBeforeLowering");
}
function addClass(id: string) {
  if (addClassReason.value || !available.value.some((entry) => entry.id === id)) return;
  emit("changeClass", id, 1);
  classPickerOpen.value = false;
}
</script>
<template>
  <ScreenSection class="space-y-small" data-testid="sheet-abilities">
    <div class="flex flex-wrap items-center justify-between gap-small">
      <h2
        :class="
          expanded ? 'text-section font-semibold' : 'text-label font-bold uppercase text-primary'
        "
      >
        {{ expanded ? tr("ui.classesSkills") : tr("ui.classes2") }}
      </h2>
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
          :label="tr('ui.namedLevel', { name: entry.name })"
          :data-testid="`class-progress-${entry.id}`"
          :editable="!readOnly"
          :disabled="saving"
          :decrease-blocked-reason="decreaseReason(entry)"
          :increase-blocked-reason="increaseReason(entry)"
          @increase="emit('changeClass', entry.id, 1)"
          @decrease="emit('changeClass', entry.id, -1)"
        />
        <p v-if="level(entry) === 10" class="text-small text-muted">{{ tr("ui.mastered") }}</p>
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
            :label="tr('ui.namedLevel', { name: entry.name })"
            :data-testid="`class-progress-${entry.id}`"
            :editable="!readOnly"
            :disabled="saving"
            :decrease-blocked-reason="decreaseReason(entry)"
            :increase-blocked-reason="increaseReason(entry)"
            @increase="emit('changeClass', entry.id, 1)"
            @decrease="emit('changeClass', entry.id, -1)"
          />
        </summary>
        <p v-if="level(entry) === 10" class="text-small text-muted">{{ tr("ui.mastered") }}</p>
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
    <slot name="add-action" :blocked-reason="addClassReason">
      <ProgressActionButton
        v-if="!readOnly"
        size="sm"
        :blocked-reason="addClassReason"
        data-testid="add-class"
        @click="classPickerOpen = true"
        >{{ tr("ui.addClass2") }}</ProgressActionButton
      >
    </slot>
    <UModal
      v-model:open="classPickerOpen"
      :title="tr('ui.addClass')"
      :description="tr('ui.chooseAClassToAddItsFirstLevel')"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-small">
          <article
            v-for="entry in available"
            :key="entry.id"
            class="space-y-small rounded-panel border border-default bg-default p-medium"
          >
            <h3 class="font-semibold">{{ entry.name }}</h3>
            <p class="text-small text-muted">{{ entry.description }}</p>
            <details :data-testid="`preview-class-${entry.id}`">
              <summary class="cursor-pointer text-small">
                {{ tr("ui.previewBenefitsAndSkills") }}
              </summary>
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
                  <p class="text-small text-muted">
                    {{ tr("ui.maximumRankValue1", { value1: skill.maxRank }) }}
                  </p>
                </li>
              </ul>
            </details>
            <ProgressActionButton
              :blocked-reason="addClassReason"
              :data-testid="`choose-class-${entry.id}`"
              @click="addClass(entry.id)"
              >{{ tr("ui.selectValue1", { value1: entry.name }) }}</ProgressActionButton
            >
          </article>
        </div>
      </template>
    </UModal>
  </ScreenSection>
</template>
