<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import CharacterNameField from "./CharacterNameField.vue";
import CharacterThemeField from "./CharacterThemeField.vue";
import CharacterLevelField from "./CharacterLevelField.vue";
import EditingLockButton from "./EditingLockButton.vue";
import AttributesSection from "./AttributesSection.vue";
import ResourcesSection from "./ResourcesSection.vue";
import ClassesSection from "./ClassesSection.vue";
import SkillsSection from "./SkillsSection.vue";
import EquipmentSection from "./EquipmentSection.vue";
import DefenseSection from "./DefenseSection.vue";
import type { Character } from "./types";
import { useSheetCalculations } from "./useSheetCalculations";

const props = defineProps<{ character: Character }>();
const character = computed(() => props.character);
const nameField = ref<InstanceType<typeof CharacterNameField>>();
const toast = useToast();
defineExpose({ focus: () => nameField.value?.focus() });
const identity = computed(() => character.value.identity);
const editingLocked = computed(() => character.value.editingLocked);
const classes = computed(() => character.value.classes);
const level = computed(() => character.value.level);
function setLevel(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  const nextLevel = Number.isFinite(value) ? Math.min(50, Math.max(5, Math.trunc(value))) : character.value.level;
  if (nextLevel !== character.value.level) {
    current.value.HP ??= maximum.value.HP;
    current.value.MP ??= maximum.value.MP;
  }
  character.value.level = nextLevel;
  input.value = String(character.value.level);
}
const skills = computed(() => character.value.skills);
const attributes = computed(() => character.value.attributes);
const equipment = computed(() => character.value.equipment);
const current = computed(() => character.value.current);
const overrides = computed(() => character.value.overrides);
const { maximum, baseDefense, defenseDetails } = useSheetCalculations(character);
function warnIfEditingLocked(event: PointerEvent) {
  if (!editingLocked.value || !(event.target instanceof Element)) return;
  if (event.target.closest(".sheet-name, .theme-field, .level-mark, .die, .resource, .defense-stat, .detail-card, .entry-add")) {
    toast.add({ id: "editing-locked", title: "Editing is locked", description: "Unlock editing to make changes.", color: "warning" });
  }
}
</script>

<template>
  <main class="sheet space-y-small rounded-panel border border-default bg-default p-medium" :class="{ 'is-locked': editingLocked }" @pointerdown.capture="warnIfEditingLocked">
    <header class="sheet-header border-b border-default pb-small">
      <fieldset :disabled="editingLocked" class="contents">
        <CharacterNameField ref="nameField" v-model="identity.name" />
        <CharacterThemeField v-model="identity.theme" />
        <CharacterLevelField :level="level" @change="setLevel" />
      </fieldset>
      <EditingLockButton v-model="character.editingLocked" />
    </header>
    <fieldset :disabled="editingLocked" class="sheet-sections">
      <section class="sheet-panel sheet-split" aria-label="Attributes and resources"><AttributesSection :attributes="attributes" /><ResourcesSection :current="current" :maximum="maximum" /></section>
      <section class="sheet-panel sheet-split" aria-label="Classes and skills"><ClassesSection :entries="classes" :locked="editingLocked" /><SkillsSection :entries="skills" :locked="editingLocked" /></section>
      <section class="sheet-panel sheet-split" aria-label="Equipment and defense"><EquipmentSection :entries="equipment" :locked="editingLocked" /><DefenseSection :overrides="overrides" :calculated="baseDefense" :details="defenseDetails" /></section>
    </fieldset>
  </main>
</template>

<style scoped>
.sheet { --sheet-label-size: 0.75rem; --sheet-meta-size: 0.625rem; --sheet-tight: 0.25rem; border-color: var(--ui-border-accented); }
.sheet-header { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto auto; gap: var(--spacing-small); align-items: stretch; }
.is-locked :deep(fieldset :is(input, select, textarea, button)) { pointer-events: none; }
.sheet-sections { display: grid; gap: var(--spacing-small); }
.sheet-panel { border: 1px solid var(--ui-border); border-radius: var(--radius-panel); padding: var(--spacing-small); min-width: 0; }
.sheet-split { display: grid; gap: var(--spacing-medium); }
@media (min-width: 640px) { .sheet-split { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .sheet-header { grid-template-columns: minmax(0, 1fr) auto; } }
</style>
