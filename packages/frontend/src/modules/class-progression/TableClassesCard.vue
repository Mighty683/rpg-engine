<script setup lang="ts">
import { computed, ref } from "vue";
import CharacterAbilities from "./CharacterAbilities.vue";
import type { ProgressionCharacter, ProgressionClass } from "./types";
const props = defineProps<{ character: ProgressionCharacter; catalog: ProgressionClass[] }>();
const detailsOpen = ref(false);
const classes = computed(() =>
  props.catalog.filter((entry) => props.character.levels[entry.id] ?? 0),
);
const skills = computed(() =>
  classes.value.flatMap((entry) =>
    entry.skills
      .filter((skill) => props.character.ranks[skill.id])
      .map((skill) => ({ ...skill, className: entry.name })),
  ),
);
</script>
<template>
  <UTooltip :delay-duration="250" :ui="{ content: 'h-auto max-w-xs p-medium' }">
    <UButton
      color="neutral"
      variant="subtle"
      class="w-full justify-between bg-elevated text-left"
      :data-testid="`table-classes-${character.id}`"
      :aria-label="`View class details for ${character.sheet.name}`"
      aria-haspopup="dialog"
      @click="detailsOpen = true"
    >
      <span class="min-w-0">
        <span class="block text-small text-muted">Classes</span>
        <span class="block whitespace-normal">{{
          classes.map((entry) => `${entry.name} ${character.levels[entry.id] ?? 0}`).join(" · ") ||
          "No classes selected"
        }}</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="shrink-0" />
    </UButton>
    <template #content>
      <div class="space-y-small" :data-testid="`class-preview-${character.id}`">
        <p class="font-semibold">{{ character.sheet.name }} · Skills</p>
        <p v-if="!skills.length" class="text-small text-muted">No acquired skills.</p>
        <p v-for="skill in skills.slice(0, 4)" :key="skill.id" class="text-small">
          {{ skill.name }} {{ character.ranks[skill.id] }}/{{ skill.maxRank }}
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
    :title="`${character.sheet.name} · Class details`"
    description="Acquired classes, skill ranks and sourced benefits."
  >
    <template #body>
      <CharacterAbilities
        v-if="detailsOpen"
        :catalog="catalog"
        :character="character"
        expanded
        read-only
      />
    </template>
  </UModal>
</template>
