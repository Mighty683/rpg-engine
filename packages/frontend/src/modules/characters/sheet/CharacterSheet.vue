<script setup lang="ts">
import ScreenSection from "../../../shared/design-system/base/ScreenSection.vue";
import { computed, ref } from "vue";
import CharacterNameField from "./identity/CharacterNameField.vue";
import CharacterThemeField from "./identity/CharacterThemeField.vue";
import CharacterLevelField from "./identity/CharacterLevelField.vue";
import AttributesSection from "./attributes/AttributesSection.vue";
import ResourcesSection from "./resources/ResourcesSection.vue";
import ResourceField from "./resources/ResourceField.vue";
import ClassesSection from "./entries/ClassesSection.vue";
import SkillsSection from "./entries/SkillsSection.vue";
import EquipmentSection from "./equipment/EquipmentSection.vue";
import DefenseSection from "./defense/DefenseSection.vue";
import type { Attribute, Character } from "./types";

const props = defineProps<{
  character: Character;
  controller?: string;
  readOnly?: boolean;
  hideReadOnlyBadge?: boolean;
  currentDice?: Record<Attribute, number>;
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
defineExpose({ focus: () => nameField.value?.focus() });
const identity = computed(() => character.value.identity);
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
</script>

<template>
  <main class="sheet space-y-small rounded-panel border border-default bg-default p-medium">
    <header class="sheet-header border-b border-default pb-small">
      <fieldset :disabled="readOnly" class="contents">
        <CharacterNameField
          ref="nameField"
          v-model="identity.name"
          :show-read-only-badge="readOnly && !hideReadOnlyBadge"
          :controller="controller"
        />
        <CharacterThemeField v-model="identity.theme" />
      </fieldset>
      <slot name="level">
        <fieldset :disabled="readOnly" class="contents">
          <CharacterLevelField :level="level" test-id="character-level" @change="setLevel" />
        </fieldset>
      </slot>
      <slot name="experience" />
      <fieldset :disabled="readOnly" class="vital-resources">
        <ResourceField
          v-for="resource in ['HP', 'MP'] as const"
          :key="resource"
          v-model="current[resource]"
          :label="resource"
          :maximum="maximum[resource]"
          :maximum-override="maximumOverrides[resource]"
          bar
          @override="updateMaximum(resource, $event)"
        />
      </fieldset>
    </header>
    <fieldset :disabled="readOnly" class="sheet-sections">
      <ScreenSection class="sheet-split attributes-resources" aria-label="Attributes and resources">
        <AttributesSection
          :attributes="attributes"
          :current-dice="currentDice"
          :read-only="readOnly"
        /><ResourcesSection
          :current="current"
          :maximum="maximum"
          :maximum-overrides="maximumOverrides"
          @override="updateMaximum"
        />
      </ScreenSection>
      <slot name="class-progression" />
      <ScreenSection
        v-if="!$slots['class-progression'] || classes.length || skills.length"
        class="sheet-split"
        aria-label="Manual classes and skills"
      >
        <ClassesSection
          v-if="!$slots['class-progression'] || classes.length"
          :entries="classes"
          :locked="readOnly"
          :existing-only="!!$slots['class-progression']"
        />
        <SkillsSection
          v-if="!$slots['class-progression'] || skills.length"
          :entries="skills"
          :locked="readOnly"
          :existing-only="!!$slots['class-progression']"
        />
      </ScreenSection>
      <ScreenSection class="sheet-split" aria-label="Equipment and defense">
        <EquipmentSection :entries="equipment" :locked="readOnly" /><DefenseSection
          :overrides="overrides"
          :calculated="baseDefense"
          :details="defenseDetails"
          :includes-class-effects="!!$slots['class-progression']"
        />
      </ScreenSection>
    </fieldset>
  </main>
</template>

<style scoped src="./sheet-layout.css"></style>
