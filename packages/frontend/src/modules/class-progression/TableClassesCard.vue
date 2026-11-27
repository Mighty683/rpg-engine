<script setup lang="ts">
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
      :aria-label="`View class details for ${name}`"
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
        <p class="font-semibold">{{ name }} · Skills</p>
        <SkeletonRegion v-if="loading" label="Loading skills…" class="space-y-small"
          ><SkeletonBlock class="h-4 w-32" /><SkeletonBlock class="h-4 w-24"
        /></SkeletonRegion>
        <p v-else-if="failed" class="text-small">Skills could not be loaded.</p>
        <p v-else-if="!skills.length" class="text-small text-muted">No acquired skills.</p>
        <p v-for="skill in skills.slice(0, 4)" :key="skill.id" class="text-small">
          {{ skill.name }} {{ character?.ranks[skill.id] }}/{{ skill.maxRank }}
          <span class="text-muted">· {{ skill.className }}</span>
        </p>
        <p v-if="skills.length > 4" class="text-small text-muted">
          +{{ skills.length - 4 }} more skills
        </p>
        <p class="text-small text-muted">Click for full class details.</p>
      </div>
    </template>
  </UTooltip>
  <UModal
    v-model:open="detailsOpen"
    :ui="{ content: 'max-w-3xl' }"
    :title="`${name} · Class details`"
    description="Acquired classes, skill ranks and their benefits."
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
            >+ Add class</UButton
          >
          <p v-else class="text-small text-muted">You need edit access to add a class.</p>
        </template>
      </CharacterAbilities>
      <p v-else-if="detailsOpen" class="text-small text-muted">
        Class progression is unavailable for this character.
      </p>
    </template>
  </UModal>
</template>
