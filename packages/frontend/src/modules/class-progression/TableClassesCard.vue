<script setup lang="ts">
import { computed, ref } from "vue";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import CharacterAbilities from "./CharacterAbilities.vue";
import type { ManagedAbilities, ProgressionCharacter, ProgressionClass } from "./types";

const props = defineProps<{
  id?: string;
  name?: string;
  summary?: string[];
  character?: ProgressionCharacter | ManagedAbilities;
  catalog: ProgressionClass[];
  loading?: boolean;
  failed?: boolean;
}>();
const emit = defineEmits<{ inspect: []; retry: [] }>();
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
    classes.value.map((entry) => `${entry.name} ${props.character?.levels[entry.id] ?? 0}`),
);
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
      class="w-full justify-between bg-elevated text-left"
      :data-testid="`table-classes-${id}`"
      :aria-label="`View class details for ${name}`"
      aria-haspopup="dialog"
      @mouseenter="emit('inspect')"
      @focus="emit('inspect')"
      @click="open"
    >
      <span class="min-w-0">
        <span class="block text-small text-muted">Classes</span>
        <span class="block whitespace-normal break-words">{{
          summary.join(" · ") || "No classes selected"
        }}</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="shrink-0" />
    </UButton>
    <template #content>
      <div class="space-y-small" :data-testid="`class-preview-${id}`">
        <p class="font-semibold">{{ name }} · Skills</p>
        <p v-if="loading" class="text-small">Loading skills…</p>
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
      <ContentState v-if="loading" kind="loading">Loading classes…</ContentState>
      <ContentState v-else-if="failed" kind="error" @retry="emit('retry')" />
      <CharacterAbilities
        v-else-if="detailsOpen && character"
        :catalog="catalog"
        :character="character"
        expanded
        read-only
      />
    </template>
  </UModal>
</template>
