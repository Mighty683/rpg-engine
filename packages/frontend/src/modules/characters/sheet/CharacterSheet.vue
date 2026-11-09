<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import CharacterNameField from "./identity/CharacterNameField.vue";
import CharacterThemeField from "./identity/CharacterThemeField.vue";
import CharacterLevelField from "./identity/CharacterLevelField.vue";
import EditingLockButton from "./identity/EditingLockButton.vue";
import AttributesSection from "./attributes/AttributesSection.vue";
import ResourcesSection from "./resources/ResourcesSection.vue";
import ClassesSection from "./entries/ClassesSection.vue";
import SkillsSection from "./entries/SkillsSection.vue";
import EquipmentSection from "./equipment/EquipmentSection.vue";
import DefenseSection from "./defense/DefenseSection.vue";
import type { Character } from "./types";

const props = defineProps<{
  character: Character;
  controller?: string;
  readOnly?: boolean;
  maximum: Record<"HP" | "MP" | "IP", number>;
  maximumOverrides: Record<"HP" | "MP" | "IP", number | null>;
  baseDefense: Record<"DEF" | "MAG DEF" | "INIT", number | null>;
  defenseDetails: Record<
    "DEF" | "MAG DEF" | "INIT",
    { name: string; value: number; modifier?: boolean }[]
  >;
}>();
const emit = defineEmits<{
  overrideMaximum: [resource: "HP" | "MP" | "IP", value: number | null];
}>();
function updateMaximum(resource: "HP" | "MP" | "IP", value: number | null) {
  emit("overrideMaximum", resource, value);
}
const character = computed(() => props.character);
const nameField = ref<InstanceType<typeof CharacterNameField>>();
const toast = useToast();
defineExpose({ focus: () => nameField.value?.focus() });
const identity = computed(() => character.value.identity);
const editingLocked = computed(() => props.readOnly || character.value.editingLocked);
const classes = computed(() => character.value.classes);
const level = computed(() => character.value.level);
function setLevel(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  const nextLevel = Number.isFinite(value)
    ? Math.min(50, Math.max(5, Math.trunc(value)))
    : character.value.level;
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
const maximum = computed(() => props.maximum);
const baseDefense = computed(() => props.baseDefense);
const defenseDetails = computed(() => props.defenseDetails);
function warnIfEditingLocked(event: PointerEvent) {
  if (props.readOnly || !editingLocked.value || !(event.target instanceof Element)) return;
  if (
    event.target.closest(
      ".sheet-name, .theme-field, .level-mark, .die, .resource, .defense-stat, .detail-card, .entry-add",
    )
  ) {
    toast.add({
      id: "editing-locked",
      title: "Editing is locked",
      description: "Unlock editing to make changes.",
      color: "warning",
    });
  }
}
</script>

<template>
  <main
    class="sheet space-y-small rounded-panel border border-default bg-default p-medium"
    :class="{ 'is-locked': editingLocked }"
    @pointerdown.capture="warnIfEditingLocked"
  >
    <header class="sheet-header border-b border-default pb-small">
      <fieldset :disabled="editingLocked" class="contents">
        <CharacterNameField
          ref="nameField"
          v-model="identity.name"
          :read-only="readOnly"
          :controller="controller"
        />
        <CharacterThemeField v-model="identity.theme" />
        <CharacterLevelField :level="level" @change="setLevel" />
      </fieldset>
      <EditingLockButton v-if="!readOnly" v-model="character.editingLocked" />
    </header>
    <p v-if="!readOnly" class="text-sm text-muted">
      Lock editing prevents accidental changes in this browser only. It does not lock the sheet for
      other people.
    </p>
    <fieldset :disabled="editingLocked" class="sheet-sections">
      <section class="sheet-panel sheet-split" aria-label="Attributes and resources">
        <AttributesSection :attributes="attributes" /><ResourcesSection
          :current="current"
          :maximum="maximum"
          :maximum-overrides="maximumOverrides"
          @override="updateMaximum"
        />
      </section>
      <section class="sheet-panel sheet-split" aria-label="Classes and skills">
        <ClassesSection :entries="classes" :locked="editingLocked" /><SkillsSection
          :entries="skills"
          :locked="editingLocked"
        />
      </section>
      <section class="sheet-panel sheet-split" aria-label="Equipment and defense">
        <EquipmentSection :entries="equipment" :locked="editingLocked" /><DefenseSection
          :overrides="overrides"
          :calculated="baseDefense"
          :details="defenseDetails"
        />
      </section>
    </fieldset>
  </main>
</template>

<style scoped>
.sheet {
  --sheet-label-size: 0.75rem;
  --sheet-meta-size: 0.625rem;
  --sheet-tight: 0.25rem;
  border-color: var(--ui-border-accented);
}
.sheet-header {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto auto;
  gap: var(--spacing-small);
  align-items: stretch;
}
.is-locked :deep(fieldset :is(input, select, textarea, button)) {
  pointer-events: none;
}
.sheet-sections {
  display: grid;
  gap: var(--spacing-small);
}
.sheet-panel {
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  padding: var(--spacing-small);
  min-width: 0;
}
.sheet-split {
  display: grid;
  gap: var(--spacing-medium);
}
@media (min-width: 640px) {
  .sheet-split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .sheet-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
