<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useOptimisticSave } from "../../src/shared/useOptimisticSave";
import ClassManagementPreview from "../../src/modules/class-management/ClassManagementPreview.vue";
import FreeBenefitsEditor from "../../src/modules/class-management/FreeBenefitsEditor.vue";
import SkillsEditor from "../../src/modules/class-management/SkillsEditor.vue";
import { applyCatalogChange, classCatalogApiKey } from "../../src/modules/class-management/catalog";
import type {
  BenefitDraft,
  ClassCatalog,
  ClassCatalogChange,
  ClassDefinition,
  SkillDraft,
} from "../../src/modules/class-management/types";
import ProgressionPrototype from "../class-progression/ProgressionPrototype.vue";

const props = defineProps<{ screen: string; context: string }>();
const emit = defineEmits<{ navigate: [screen: string]; switchContext: [context: string] }>();
const api = inject(classCatalogApiKey);
if (!api) throw new Error("Missing prototype class catalog API");
const toast = useToast();
const optimistic = useOptimisticSave<ClassCatalog, ClassCatalogChange[]>({
  apply: (base, changes) => changes.reduce(applyCatalogChange, base),
  merge: (previous, next) => [...previous, ...next],
  save: (_base, changes) => api.save(changes),
  refresh: () => api.load(),
});
const loading = ref(true);
const loadFailed = ref(false);
const selectedId = ref("");
const scope = computed(() => (props.context === "Library" ? "library" : "game"));
const entries = computed(() => optimistic.displayed.value?.[scope.value] ?? []);
const current = computed(
  () => entries.value.find(({ id }) => id === selectedId.value) ?? entries.value[0],
);
const editable = computed(() => !optimistic.paused.value && !loading.value && !loadFailed.value);
const activeScreen = computed(() => {
  if (props.screen === "Manage" || (scope.value === "game" && props.screen === "Create"))
    return "List";
  if (scope.value === "library" && ["Copy", "Character"].includes(props.screen)) return "List";
  if (props.screen === "Details" && !current.value) return "List";
  return props.screen;
});

function report(message: string) {
  toast.add({ title: message, color: "error" });
}
watch(optimistic.error, (error) => {
  if (!error) return;
  toast.add({
    title: error.message,
    color: "error",
    actions: optimistic.paused.value
      ? [{ label: "Reload saved classes", onClick: () => void optimistic.retry() }]
      : [],
  });
});

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    optimistic.setSnapshot(await api!.load());
  } catch {
    loadFailed.value = true;
    report("Could not load classes.");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function submit(change: ClassCatalogChange) {
  if (editable.value) optimistic.submit([change]);
}
function open(id: string) {
  selectedId.value = id;
  emit("navigate", "Details");
}
function create(name: string) {
  const id = crypto.randomUUID();
  submit({
    kind: "put",
    scope: "library",
    entry: { id, name, description: "", skills: [], benefits: [] },
  });
  open(id);
}
function copy(from: string) {
  const id = crypto.randomUUID();
  submit({ kind: "copy", from, id });
  open(id);
}
function updateClass(change: Partial<Omit<ClassDefinition, "id">>) {
  if (current.value)
    submit({ kind: "put", scope: scope.value, entry: { ...current.value, ...change } });
}
function benefit(name: string): BenefitDraft {
  return { id: crypto.randomUUID(), name, kind: "text", description: "", stat: "", amount: "" };
}
function addSkill() {
  if (!current.value) return;
  updateClass({
    skills: [
      ...current.value.skills,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        maxRank: "1",
        benefits: [],
      },
    ],
  });
}
function updateSkill(id: string, change: Partial<SkillDraft>) {
  if (!current.value) return;
  updateClass({
    skills: current.value.skills.map((skill) =>
      skill.id === id ? { ...skill, ...change } : skill,
    ),
  });
}
function addSkillBenefit(id: string, name: string) {
  const skill = current.value?.skills.find((entry) => entry.id === id);
  if (skill) updateSkill(id, { benefits: [...skill.benefits, benefit(name)] });
}

const removal = ref<{ classId: string; skill: SkillDraft } | null>(null);
const affected = computed(
  () =>
    optimistic.displayed.value?.characters.filter(
      (character) => removal.value && character.ranks[removal.value.skill.id],
    ) ?? [],
);
function removeSkill(id: string) {
  const entry = current.value;
  const skill = entry?.skills.find((item) => item.id === id);
  if (!entry || !skill) return;
  if (scope.value === "library") {
    updateClass({ skills: entry.skills.filter((item) => item.id !== id) });
    return;
  }
  removal.value = { classId: entry.id, skill };
  if (!affected.value.length) confirmRemoval();
}
function confirmRemoval() {
  if (!removal.value) return;
  submit({
    kind: "remove-skill",
    classId: removal.value.classId,
    skillId: removal.value.skill.id,
    confirmedCharacters: affected.value.map(({ id }) => id),
  });
  removal.value = null;
}
function removeClass(id: string) {
  const affected =
    optimistic.displayed.value?.characters.filter((character) => character.levels[id]) ?? [];
  if (affected.length) {
    report(`Remove this class from ${affected.map(({ name }) => name).join(", ")} first.`);
    return;
  }
  submit({ kind: "remove-class", id });
}

watch(
  () => props.screen,
  async (_screen, previous) => {
    if (previous === "Character") await load();
  },
);
</script>

<template>
  <p v-if="loading" class="p-section" role="status">Loading classes…</p>
  <UButton v-else-if="loadFailed" class="m-section" @click="load">Retry loading classes</UButton>
  <ClassManagementPreview
    v-else
    :screen="activeScreen"
    :context="context"
    :entries="activeScreen === 'Copy' ? (optimistic.displayed.value?.library ?? []) : entries"
    :current="current"
    :editable="editable"
    @navigate="emit('navigate', $event)"
    @switch-context="emit('switchContext', $event)"
    @open="open"
    @create="create"
    @copy="copy"
    @remove-class="removeClass"
    @update-class="updateClass"
  >
    <template #skills>
      <fieldset v-if="current" :disabled="!editable">
        <SkillsEditor
          :key="current.id"
          :skills="current.skills"
          @add="addSkill"
          @update="updateSkill"
          @remove="removeSkill"
          @add-benefit="addSkillBenefit"
        />
      </fieldset>
    </template>
    <template #free-benefits>
      <fieldset v-if="current" :disabled="!editable">
        <FreeBenefitsEditor
          :key="current.id"
          :benefits="current.benefits"
          @add="(name) => updateClass({ benefits: [...current!.benefits, benefit(name)] })"
          @update="
            (id, change) =>
              updateClass({
                benefits: current!.benefits.map((entry) =>
                  entry.id === id ? { ...entry, ...change } : entry,
                ),
              })
          "
          @remove="
            (id) => updateClass({ benefits: current!.benefits.filter((entry) => entry.id !== id) })
          "
        />
      </fieldset>
    </template>
    <template #characters>
      <p v-if="optimistic.saving.value" role="status">Loading character classes…</p>
      <ProgressionPrototype v-else />
    </template>
  </ClassManagementPreview>
  <UModal
    :open="!!removal"
    :title="`Remove ${removal?.skill.name || 'skill'}?`"
    description="This removes the skill from the game class and these characters."
    @update:open="
      (open: boolean) => {
        if (!open) removal = null;
      }
    "
  >
    <template #body>
      <ul class="list-disc pl-medium" data-testid="affected-skill-users">
        <li v-for="character in affected" :key="character.id">{{ character.name }}</li>
      </ul>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        data-testid="cancel-skill-removal"
        @click="removal = null"
        >Cancel</UButton
      >
      <UButton color="error" data-testid="confirm-skill-removal" @click="confirmRemoval"
        >Remove skill</UButton
      >
    </template>
  </UModal>
</template>
