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
  RemovalImpact,
  SaveLibraryChoice,
} from "../../src/modules/class-management/types";
import LabeledInput from "../../src/shared/design-system/base/LabeledInput.vue";
import LabeledSelect from "../../src/shared/design-system/base/LabeledSelect.vue";
import { completeDefinition, ContractError } from "./contract";
import ProgressionPrototype from "../class-progression/ProgressionPrototype.vue";

const props = defineProps<{ screen: string; context: string }>();
const emit = defineEmits<{ navigate: [screen: string]; switchContext: [context: string] }>();
const api = inject(classCatalogApiKey);
if (!api) throw new Error("Missing prototype class catalog API");
const toast = useToast();
const optimistic = useOptimisticSave<ClassCatalog, ClassCatalogChange[]>({
  apply: (base, changes) => changes.reduce(applyCatalogChange, base),
  merge: (previous, next) => [...previous, ...next],
  save: (base, changes) => api.save(base, changes),
  refresh: () => api.load(),
});
const loading = ref(true);
const loadFailed = ref(false);
const selectedId = ref("");
const scope = computed(() => (props.context === "Library" ? "library" : "game"));
const entries = computed(() => optimistic.displayed.value?.[scope.value] ?? []);
const drafts = ref<Record<string, ClassDefinition>>({});
const current = computed(() => {
  const entry = entries.value.find(({ id }) => id === selectedId.value) ?? entries.value[0];
  return entry && (drafts.value[entry.id] ?? entry);
});
const actionPending = ref(false);
const awaitingCopiedIds = computed(
  () =>
    scope.value === "game" &&
    props.screen === "Details" &&
    current.value &&
    !optimistic.acknowledged.value?.game.some(({ id }) => id === current.value?.id),
);
const editable = computed(
  () =>
    !optimistic.paused.value &&
    !loading.value &&
    !loadFailed.value &&
    !actionPending.value &&
    !awaitingCopiedIds.value,
);
const canRunAction = computed(() => editable.value && !optimistic.saving.value);
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
  if (!current.value) return;
  const entry = { ...current.value, ...change };
  if (!completeDefinition(entry)) {
    drafts.value[entry.id] = entry;
    return;
  }
  delete drafts.value[entry.id];
  submit({ kind: "put", scope: scope.value, entry });
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

const removal = ref<{ entry: ClassDefinition; name: string; impact: RemovalImpact } | null>(null);
const saveSource = ref<ClassDefinition | null>(null);
const saveMode = ref<"new" | "update">("new");
const saveName = ref("");
let newTemplateId = "";
const templateId = ref("");
const templates = computed(() => optimistic.displayed.value?.library ?? []);
const saveModeItems = computed(() => [
  { label: "Save as new", value: "new" },
  ...(templates.value.length ? [{ label: "Update existing template", value: "update" }] : []),
]);

async function runAction(action: (base: ClassCatalog) => Promise<void>) {
  const base = optimistic.acknowledged.value;
  if (!canRunAction.value || !base) return;
  actionPending.value = true;
  try {
    await action(base);
  } catch (error) {
    const actions =
      error instanceof ContractError && (error.code === "stale_revision" || error.status >= 500)
        ? [{ label: "Reload saved classes", onClick: () => void load() }]
        : [];
    toast.add({
      title: error instanceof Error ? error.message : "Could not confirm the change.",
      color: "error",
      actions,
    });
  } finally {
    actionPending.value = false;
  }
}

function removeSkill(id: string) {
  const entry = current.value;
  const skill = entry?.skills.find((item) => item.id === id);
  if (!entry || !skill) return;
  const skills = entry.skills.filter((item) => item.id !== id);
  if (
    scope.value === "library" ||
    !entries.value.find((item) => item.id === entry.id)?.skills.some((item) => item.id === id)
  ) {
    updateClass({ skills });
    return;
  }
  const next = { ...entry, skills };
  if (!completeDefinition(next)) {
    report("Finish the incomplete skills or benefits first.");
    return;
  }
  void saveGameEdit({ entry: next, name: skill.name, impact: [] });
}

async function saveGameEdit(change: NonNullable<typeof removal.value>) {
  await runAction(async (base) => {
    try {
      optimistic.setSnapshot(await api!.updateGameClass(base, change.entry, change.impact));
      delete drafts.value[change.entry.id];
      removal.value = null;
    } catch (error) {
      if (
        !(error instanceof ContractError) ||
        error.code !== "skill_removal_confirmation_required" ||
        !error.impact
      )
        throw error;
      removal.value = { ...change, impact: error.impact };
    }
  });
}

function removeClass(id: string) {
  void runAction(async (base) => {
    optimistic.setSnapshot(await api!.removeGameClass(base, id));
  });
}
function openSave(id: string) {
  saveSource.value = entries.value.find((entry) => entry.id === id) ?? null;
  saveMode.value = "new";
  newTemplateId = crypto.randomUUID();
  saveName.value = saveSource.value?.name ?? "";
  templateId.value = "";
}
function saveToLibrary() {
  const source = saveSource.value;
  if (!source) return;
  const choice: SaveLibraryChoice =
    saveMode.value === "new"
      ? { mode: "new", id: newTemplateId, name: saveName.value.trim() }
      : { mode: "update", templateId: templateId.value };
  void runAction(async (base) => {
    optimistic.setSnapshot(await api!.saveToLibrary(base, source.id, choice));
    saveSource.value = null;
  });
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
    :actions-enabled="canRunAction"
    :has-draft="Boolean(current && drafts[current.id])"
    @navigate="emit('navigate', $event)"
    @switch-context="emit('switchContext', $event)"
    @open="open"
    @create="create"
    @copy="copy"
    @remove-class="removeClass"
    @save-to-library="openSave"
    @update-class="updateClass"
  >
    <template #skills>
      <fieldset v-if="current" :disabled="!editable">
        <SkillsEditor
          :key="current.id"
          :skills="current.skills"
          :remove-disabled="scope === 'game' && !canRunAction"
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
    :dismissible="!actionPending"
    :title="`Remove ${removal?.name || 'skill'}?`"
    description="This removes the skill from the game class and these characters."
    @update:open="
      (open: boolean) => {
        if (!open) removal = null;
      }
    "
  >
    <template #body>
      <ul class="list-disc pl-medium" data-testid="affected-skill-users">
        <li
          v-for="character in removal?.impact.flatMap((item) => item.characters)"
          :key="character.id"
        >
          {{ character.name }} · Rank {{ character.rank }}
        </li>
      </ul>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        data-testid="cancel-skill-removal"
        :disabled="actionPending"
        @click="removal = null"
        >Cancel</UButton
      >
      <UButton
        color="error"
        data-testid="confirm-skill-removal"
        :disabled="actionPending"
        @click="removal && saveGameEdit(removal)"
        >Remove skill</UButton
      >
    </template>
  </UModal>
  <UModal
    :open="!!saveSource"
    title="Save to library"
    :description="saveSource?.name"
    @update:open="
      (open: boolean) => {
        if (!open && !actionPending) saveSource = null;
      }
    "
  >
    <template #body>
      <form class="space-y-medium" id="save-class-to-library" @submit.prevent="saveToLibrary">
        <LabeledSelect
          v-model="saveMode"
          label="Save as"
          :items="saveModeItems"
          :disabled="actionPending"
          data-testid="library-save-mode"
        >
          <template #item-label="{ item }"
            ><span :data-testid="`library-save-${item.value}`">{{ item.label }}</span></template
          >
        </LabeledSelect>
        <LabeledInput
          v-if="saveMode === 'new'"
          v-model="saveName"
          label="Template name"
          maxlength="100"
          :disabled="actionPending"
          data-testid="library-save-name"
        />
        <LabeledSelect
          v-else
          v-model="templateId"
          label="Template"
          :items="templates.map(({ id, name }) => ({ label: name, value: id }))"
          :disabled="actionPending"
          data-testid="library-save-template"
        >
          <template #item-label="{ item }"
            ><span :data-testid="`library-template-${item.value}`">{{ item.label }}</span></template
          >
        </LabeledSelect>
      </form>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        :disabled="actionPending"
        @click="saveSource = null"
        >Cancel</UButton
      >
      <UButton
        type="submit"
        form="save-class-to-library"
        :loading="actionPending"
        :disabled="saveMode === 'new' ? !saveName.trim() : !templateId"
        data-testid="confirm-save-to-library"
        >Save to library</UButton
      >
    </template>
  </UModal>
</template>
