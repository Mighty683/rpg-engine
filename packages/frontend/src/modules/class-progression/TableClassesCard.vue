<script setup lang="ts">
import { tr } from "../../shared/i18n";
import AbilitiesSkeleton from "./AbilitiesSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import { computed, ref } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import ClassLevelBars from "./ClassLevelBars.vue";
import type { PartyCharacter } from "../game-table/types";
import CharacterAbilities from "./CharacterAbilities.vue";
import type { ManagedAbilities, ProgressionCharacter, ProgressionClass } from "./types";

const props = defineProps<{
  id?: string;
  name?: string;
  summary?: PartyCharacter["classSummary"];
  character?: ProgressionCharacter | ManagedAbilities;
  catalog: ProgressionClass[];
  loading?: boolean;
  failed?: boolean;
  canAddClass?: boolean;
}>();
const emit = defineEmits<{ inspect: []; retry: []; openSheet: [] }>();
const detailsOpen = ref(false);
const id = computed(
  () => props.id ?? (props.character && "id" in props.character ? props.character.id : ""),
);
const name = computed(
  () =>
    props.name ?? (props.character && "sheet" in props.character ? props.character.sheet.name : ""),
);
const classes = computed(() => props.catalog.filter((entry) => props.character?.levels[entry.id]));
const skills = computed(() =>
  classes.value.flatMap((entry) =>
    entry.skills
      .filter((skill) => props.character?.ranks[skill.id])
      .map((skill) => ({ ...skill, className: entry.name })),
  ),
);
const summary = computed(
  () =>
    props.summary ??
    classes.value.map((entry) => ({
      name: entry.name,
      level: props.character?.levels[entry.id] ?? null,
    })),
);
function openSheet() {
  detailsOpen.value = false;
  emit("openSheet");
}
function open() {
  emit("inspect");
  detailsOpen.value = true;
}
</script>
<template>
  <UTooltip :delay-duration="250" :ui="{ content: 'h-auto max-w-xs p-medium' }">
    <UButton
      color="neutral"
      variant="subtle"
      size="xs"
      class="relative w-full cursor-pointer border border-transparent p-0 text-left hover:border-primary"
      :data-testid="`table-classes-${id}`"
      :aria-label="tr('ui.viewClassDetailsForValue1', { value1: name })"
      aria-haspopup="dialog"
      @mouseenter="emit('inspect')"
      @focus="emit('inspect')"
      @click="open"
    >
      <ClassLevelBars :entries="summary" interactive />
      <UIcon name="i-lucide-chevron-right" class="pointer-events-none absolute right-small" />
    </UButton>
    <template #content>
      <div class="space-y-small" :data-testid="`class-preview-${id}`">
        <p class="font-semibold">{{ tr("ui.value1Skills", { value1: name }) }}</p>
        <SkeletonRegion v-if="loading" :label="tr('ui.loadingSkills')" class="space-y-small"
          ><SkeletonBlock class="h-4 w-32" /><SkeletonBlock class="h-4 w-24"
        /></SkeletonRegion>
        <p v-else-if="failed" class="text-small">{{ tr("ui.skillsCouldNotBeLoaded") }}</p>
        <p v-else-if="!skills.length" class="text-small text-muted">
          {{ tr("ui.noAcquiredSkills") }}
        </p>
        <p v-for="skill in skills.slice(0, 4)" :key="skill.id" class="text-small">
          {{ skill.name }} {{ character?.ranks[skill.id] }}/{{ skill.maxRank }}
          <span class="text-muted">· {{ skill.className }}</span>
        </p>
        <p v-if="skills.length > 4" class="text-small text-muted">
          {{ tr("ui.value1MoreSkills", { value1: skills.length - 4 }) }}
        </p>
        <p class="text-small text-muted">{{ tr("ui.clickForFullClassDetails") }}</p>
      </div>
    </template>
  </UTooltip>
  <UModal
    v-model:open="detailsOpen"
    :ui="{ content: 'max-w-3xl' }"
    :title="tr('ui.value1ClassDetails', { value1: name })"
    :description="tr('ui.acquiredClassesSkillRanksAndTheirBenefits')"
  >
    <template #body>
      <AbilitiesSkeleton v-if="loading" expanded />
      <ContentState v-else-if="failed" kind="error" @retry="emit('retry')" />
      <CharacterAbilities
        v-else-if="detailsOpen && character"
        :catalog="catalog"
        :character="character"
        expanded
        read-only
      >
        <template #add-action="{ blockedReason }">
          <p v-if="blockedReason" class="text-small text-muted">{{ blockedReason }}</p>
          <UButton
            v-else-if="canAddClass"
            block
            data-testid="open-sheet-to-add-class"
            @click="openSheet"
            >{{ tr("ui.addClass2") }}</UButton
          >
          <p v-else class="text-small text-muted">{{ tr("ui.youNeedEditAccessToAddAClass") }}</p>
        </template>
      </CharacterAbilities>
      <p v-else-if="detailsOpen" class="text-small text-muted">
        {{ tr("ui.classProgressionIsUnavailableForThisCharacter") }}
      </p>
    </template>
  </UModal>
</template>
