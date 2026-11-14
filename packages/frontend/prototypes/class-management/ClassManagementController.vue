<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import ClassManagementPreview from "../../src/modules/class-management/ClassManagementPreview.vue";
import FreeBenefitsEditor from "../../src/modules/class-management/FreeBenefitsEditor.vue";
import type { BenefitDraft } from "../../src/modules/class-management/types";

const props = defineProps<{ screen: string; context: string }>();
const emit = defineEmits<{ navigate: [screen: string] }>();
const createBenefits = ref<BenefitDraft[]>([]);
const examples = () => [
  {
    id: 1,
    name: "Vitality",
    kind: "modifier" as const,
    description: "",
    stat: "maxHp",
    amount: "5",
  },
  {
    id: 2,
    name: "Martial equipment",
    kind: "text" as const,
    description: "Can equip martial armor and shields",
    stat: "",
    amount: "",
  },
];
const libraryBenefits = ref<BenefitDraft[]>(examples());
const gameBenefits = ref<BenefitDraft[]>(examples());
const benefits = computed({
  get: () =>
    props.screen === "Create"
      ? createBenefits.value
      : props.context === "Library"
        ? libraryBenefits.value
        : gameBenefits.value,
  set: (value: BenefitDraft[]) => {
    if (props.screen === "Create") createBenefits.value = value;
    else if (props.context === "Library") libraryBenefits.value = value;
    else gameBenefits.value = value;
  },
});
const libraryClass = reactive({
  name: "Guardian",
  description: "A defender who protects allies and stands firm in danger.",
});
const gameClass = reactive({ ...libraryClass });
const currentClass = computed(() => (props.context === "Library" ? libraryClass : gameClass));
let nextId = 3;
function addBenefit(name: string) {
  benefits.value.push({ id: nextId++, name, kind: "text", description: "", stat: "", amount: "" });
}
function updateBenefit(id: number, change: Partial<BenefitDraft>) {
  benefits.value = benefits.value.map((benefit) =>
    benefit.id === id ? { ...benefit, ...change } : benefit,
  );
}
function removeBenefit(id: number) {
  benefits.value = benefits.value.filter((benefit) => benefit.id !== id);
}
</script>

<template>
  <ClassManagementPreview
    :screen="screen"
    :context="context"
    :class-name="currentClass.name"
    :class-description="currentClass.description"
    @navigate="emit('navigate', $event)"
    @update-class-name="currentClass.name = $event"
    @update-class-description="currentClass.description = $event"
  >
    <template #free-benefits>
      <FreeBenefitsEditor
        :benefits="benefits"
        @add="addBenefit"
        @update="updateBenefit"
        @remove="removeBenefit"
      />
    </template>
  </ClassManagementPreview>
</template>
