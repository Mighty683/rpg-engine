<script setup lang="ts">
import { useGameEvents } from "../games/useGameEvents";
import { computed, inject, onMounted, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useOptimisticSave } from "../../shared/useOptimisticSave";
import ClassManagementPreview from "./ClassManagementPreview.vue";
import FreeBenefitsEditor from "./FreeBenefitsEditor.vue";
import SkillsEditor from "./SkillsEditor.vue";
import { applyCatalogChange, classCatalogApiKey } from "./catalog";
import type {
  BenefitDraft,
  ClassCatalog,
  ClassCatalogChange,
  ClassDefinition,
  SkillDraft,
  RemovalImpact,
  SaveLibraryChoice,
} from "./types";
import LabeledInput from "../../shared/design-system/base/LabeledInput.vue";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import { completeDefinition, ContractError } from "./contract";
import { useApiServices } from "../../shared/api-services";
import { newUuid } from "../../shared/uuid";
import ContentState from "../../shared/design-system/base/ContentState.vue";

const props = defineProps<{
  screen: string;
  context: string;
  gameId?: string;
  gameName?: string;
  canManage?: boolean;
  returnTo?: string;
  contextTo?: string;
  charactersTo?: string;
}>();
const emit = defineEmits<{ navigate: [screen: string]; switchContext: [context: string] }>();
const prototypeApi = inject(classCatalogApiKey, null);
const canManage = computed(() => Boolean(prototypeApi) || props.canManage !== false);
const api = prototypeApi ?? useApiServices().classCatalog.forContext(props.gameId, canManage.value);
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
const pendingCopyId = ref("");
const scope = computed(() => (props.context === "Library" ? "library" : "game"));
const entries = computed(() => optimistic.displayed.value?.[scope.value] ?? []);
const drafts = ref<Record<string, ClassDefinition>>({});
const current = computed(() => {
  const entry = selectedId.value
    ? entries.value.find(({ id }) => id === selectedId.value)
    : entries.value[0];
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
const readOnlyDefinition = computed(
  () => scope.value === "game" && (!canManage.value || !api.updateGameClass),
);
const canEditDefinition = computed(() => editable.value && !readOnlyDefinition.value);
const canRunAction = computed(() => canManage.value && editable.value && !optimistic.saving.value);
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
    optimistic.setSnapshot(await api.load());
  } catch {
    loadFailed.value = true;
    toast.add({
      title: "Could not load classes.",
      color: "error",
      actions: [{ label: "Retry", onClick: () => void load() }],
    });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const refreshRequested = ref(false);
const refreshing = ref(false);
function requestRefresh() {
  refreshRequested.value = true;
}
useGameEvents(
  prototypeApi ? undefined : props.gameId,
  (hint) => {
    if (hint.type === "roster") requestRefresh();
  },
  requestRefresh,
);

watch(
  [
    refreshRequested,
    refreshing,
    actionPending,
    optimistic.saving,
    optimistic.paused,
    loading,
    loadFailed,
  ],
  async () => {
    if (
      !refreshRequested.value ||
      refreshing.value ||
      actionPending.value ||
      optimistic.saving.value ||
      optimistic.paused.value ||
      loading.value ||
      loadFailed.value
    )
      return;
    refreshRequested.value = false;
    refreshing.value = true;
    const previous = optimistic.acknowledged.value;
    try {
      const snapshot = await api.load();
      if (
        actionPending.value ||
        optimistic.saving.value ||
        optimistic.acknowledged.value !== previous
      ) {
        requestRefresh();
        return;
      }
      optimistic.setSnapshot(snapshot);
    } catch {
      // Keep the current editor available. A reconnect or explicit reload will retry.
    } finally {
      refreshing.value = false;
    }
  },
);

function submit(change: ClassCatalogChange) {
  if (canManage.value && editable.value) optimistic.submit([change]);
}
function open(id: string) {
  selectedId.value = id;
  emit("navigate", "Details");
}
function create(name: string) {
  const id = newUuid();
  submit({
    kind: "put",
    scope: "library",
    entry: { id, name, description: "", skills: [], benefits: [] },
  });
  open(id);
}
function copy(from: string) {
  const id = newUuid();
  pendingCopyId.value = id;
  submit({ kind: "copy", from, id });
  open(id);
}
watch([optimistic.saving, optimistic.paused, optimistic.acknowledged], () => {
  const id = pendingCopyId.value;
  if (!id || optimistic.saving.value || optimistic.paused.value) return;
  pendingCopyId.value = "";
  if (optimistic.acknowledged.value?.game.some((entry) => entry.id === id)) return;
  if (props.screen === "Details" && selectedId.value === id) emit("navigate", "Copy");
});

function updateClass(change: Partial<Omit<ClassDefinition, "id">>) {
  if (!current.value || !canEditDefinition.value) return;
  const entry = { ...current.value, ...change };
  if (!completeDefinition(entry)) {
    drafts.value[entry.id] = entry;
    return;
  }
  delete drafts.value[entry.id];
  submit({ kind: "put", scope: scope.value, entry });
}
function benefit(name: string): BenefitDraft {
  return { id: newUuid(), name, kind: "text", description: "", stat: "", amount: "" };
}
function addSkill() {
  if (!current.value) return;
  updateClass({
    skills: [
      ...current.value.skills,
      {
        id: newUuid(),
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

const removal = ref<{ entry: ClassDefinition; name: string; impact?: RemovalImpact } | null>(null);
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
      !(error instanceof ContractError) || error.code === "stale_revision" || error.status >= 500
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
  void saveGameEdit({ entry: next, name: skill.name });
}

async function saveGameEdit(change: NonNullable<typeof removal.value>) {
  await runAction(async (base) => {
    try {
      if (
        !prototypeApi &&
        base.game.find(({ id }) => id === change.entry.id)?.revision !== change.entry.revision
      ) {
        removal.value = null;
        throw new ContractError(
          409,
          "stale_revision",
          "This class changed. Reload classes and try again.",
        );
      }
      optimistic.setSnapshot(await api.updateGameClass!(base, change.entry, change.impact));
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
    optimistic.setSnapshot(await api.removeGameClass!(base, id));
  });
}
function openSave(id: string) {
  saveSource.value = entries.value.find((entry) => entry.id === id) ?? null;
  saveMode.value = "new";
  newTemplateId = newUuid();
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
    optimistic.setSnapshot(await api.saveToLibrary(base, source.id, choice));
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
  <ContentState v-if="loading" kind="loading" data-testid="loading-classes"
    >Loading classes…</ContentState
  >
  <ContentState
    v-else-if="loadFailed"
    kind="error"
    retry-label="Retry loading classes"
    retry-test-id="retry-classes"
    @retry="load"
  />
  <ClassManagementPreview
    v-else
    :screen="activeScreen"
    :context="context"
    :entries="activeScreen === 'Copy' ? (optimistic.displayed.value?.library ?? []) : entries"
    :current="current"
    :editable="canManage && editable"
    :definition-editable="canEditDefinition"
    :read-only-definition="readOnlyDefinition"
    :can-manage="canManage"
    :show-removal="Boolean(api.removeGameClass)"
    :game-name="gameName"
    :context-to="contextTo"
    :return-to="returnTo"
    :characters-to="charactersTo"
    :show-characters="Boolean(prototypeApi || charactersTo)"
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
      <fieldset
        v-if="current"
        class="min-w-0"
        :disabled="!canEditDefinition && !readOnlyDefinition"
      >
        <SkillsEditor
          :key="current.id"
          :skills="current.skills"
          :read-only="readOnlyDefinition"
          :remove-disabled="scope === 'game' && !canRunAction"
          @add="addSkill"
          @update="updateSkill"
          @remove="removeSkill"
          @add-benefit="addSkillBenefit"
        />
      </fieldset>
    </template>
    <template #free-benefits>
      <fieldset
        v-if="current"
        class="min-w-0"
        :disabled="!canEditDefinition && !readOnlyDefinition"
      >
        <FreeBenefitsEditor
          :key="current.id"
          :benefits="current.benefits"
          :read-only="readOnlyDefinition"
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
      <slot v-else name="characters" />
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
          v-for="character in removal?.impact?.flatMap((item) => item.characters)"
          :key="character.id"
        >
          {{ character.name }} · Rank {{ character.rank }}
        </li>
      </ul>
      <p v-if="removal?.impact?.length === 0">No characters currently have ranks in this skill.</p>
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
