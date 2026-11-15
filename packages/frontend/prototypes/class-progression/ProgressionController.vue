<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useOptimisticSave } from "../../src/shared/useOptimisticSave";
import { useToast } from "@nuxt/ui/composables";
import { useProgressionApi } from "../../src/modules/class-progression/services";
import type {
  ProgressionSnapshot,
  ProgressionAllocation,
  ProgressionExperience,
} from "../../src/modules/class-progression/types";
import {
  characterLevelError,
  CLASS_LEVEL_EXP_COST,
  experienceError,
  progressionError,
  withProgressionRanks,
} from "../../src/modules/class-progression/model";
import ProgressionWorkspace from "../../src/modules/class-progression/ProgressionWorkspace.vue";
import LabeledSelect from "../../src/shared/design-system/base/LabeledSelect.vue";
import { resetPrototypeBackend, setPrototypeScenario } from "../api";
import type { PrototypeScenario } from "../api";

const props = defineProps<{ readOnly?: boolean; playerCharacterId?: string }>();
const api = useProgressionApi();
const toast = useToast();
const optimistic = useOptimisticSave<ProgressionSnapshot, Record<string, ProgressionAllocation>>({
  apply: (base, changes) => ({
    ...base,
    characters: base.characters.map((character) => {
      const change = changes[character.id];
      if (!change) return character;
      return withProgressionRanks(
        base.catalog,
        {
          ...character,
          sheet: { ...character.sheet, level: change.level },
          experience: change.experience,
        },
        change.ranks,
        change.levels,
      );
    }),
  }),
  merge: (previous, next) => ({ ...previous, ...next }),
  save: async (base, changes) => {
    let result = base;
    for (const [id, allocation] of Object.entries(changes)) {
      const character = result.characters.find((entry) => entry.id === id)!;
      result = await api.save(id, { expectedRevision: character.revision, ...allocation });
    }
    return result;
  },
  refresh: () => api.load(),
});
const snapshot = computed(() => optimistic.displayed.value ?? { catalog: [], characters: [] });
watch(optimistic.error, (error) => {
  if (!error) return;
  const refreshAction = {
    label: "Refresh saved data",
    "data-testid": "refresh-progression-error",
    onClick: () => {
      void optimistic.retry();
    },
  };
  toast.add({
    title:
      error.status === 400 || error.status === 422
        ? "The change was rejected and reverted."
        : "Changes could not be confirmed. Local changes are retained.",
    description: "Refresh saved data to reconcile before continuing.",
    color: "error",
    actions: [refreshAction],
  });
});
const selectedId = ref(props.playerCharacterId ?? "catalog-rowan");
const loading = ref(true);
const loadFailed = ref(false);
const scenario = ref<PrototypeScenario>("default");
const selected = computed(() =>
  snapshot.value.characters.find((entry) => entry.id === selectedId.value),
);
function report(error: unknown) {
  toast.add({
    title: "Class progression could not be saved or loaded",
    description: error instanceof Error ? error.message : "Try again.",
    color: "error",
  });
}
async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    if (optimistic.paused.value) await optimistic.retry();
    else optimistic.setSnapshot(await api.load());
  } catch (error) {
    loadFailed.value = true;
    report(error);
  } finally {
    loading.value = false;
  }
}
const levels = computed(() => selected.value?.levels ?? {});
function submit(changes: Partial<ProgressionAllocation>) {
  if (!selected.value || props.readOnly || optimistic.paused.value) return;
  if (props.playerCharacterId && selected.value.id !== props.playerCharacterId) return;
  const { sheet, levels, ranks, experience } = selected.value;
  const allocation = { level: sheet.level, levels, ranks, experience, ...changes };
  const error =
    characterLevelError(allocation.level) ??
    progressionError(snapshot.value.catalog, allocation.levels, allocation.ranks) ??
    experienceError(allocation.experience, allocation.levels);
  if (error) {
    report(new Error(error));
    return;
  }
  optimistic.submit({ [selected.value.id]: allocation });
}
function changeClass(id: string, delta: number) {
  if (!selected.value) return;
  const nextLevels = { ...levels.value, [id]: (levels.value[id] ?? 0) + delta };
  const { experience } = selected.value;
  submit({
    levels: nextLevels,
    experience: { ...experience, current: experience.current - delta * CLASS_LEVEL_EXP_COST },
  });
}
function changeSkill(id: string, delta: number) {
  if (!selected.value) return;
  submit({
    ranks: { ...selected.value.ranks, [id]: (selected.value.ranks[id] ?? 0) + delta },
  });
}
function changeExperience(field: keyof ProgressionExperience, value: number) {
  if (!selected.value || selected.value.experience[field] === value) return;
  submit({ experience: { ...selected.value.experience, [field]: value } });
}
function changeLevel(level: number) {
  if (level !== selected.value?.sheet.level) submit({ level });
}
async function reset() {
  resetPrototypeBackend();
  scenario.value = "default";
  selectedId.value = "catalog-rowan";
  await load();
}
function changeScenario(value: string | number | undefined) {
  if (!value) return;
  scenario.value = value as PrototypeScenario;
  setPrototypeScenario(scenario.value);
}
onMounted(load);
</script>
<template>
  <main class="min-h-screen bg-default p-section text-default">
    <div class="mx-auto max-w-5xl space-y-section">
      <header v-if="!playerCharacterId">
        <p class="text-label text-muted">THE LANTERN ROAD · FABULA ULTIMA</p>
        <h1 class="text-heading font-semibold">Character classes & skills</h1>
        <p class="text-small text-muted">
          Illustrative game-class catalog. Saved within this gallery session; reload or Reset
          restores examples. Skill effects are sample definitions, not official rules.
        </p>
      </header>
      <div v-if="!playerCharacterId" class="flex flex-wrap items-end gap-medium">
        <LabeledSelect
          :model-value="scenario"
          label="Review response"
          :items="[
            { label: 'Normal', value: 'default' },
            { label: 'Save/load error', value: 'error' },
            { label: 'Slow response', value: 'loading' },
            { label: 'Empty roster', value: 'empty' },
          ]"
          data-testid="response-scenario"
          @update:model-value="changeScenario"
        >
          <template #item-label="{ item }"
            ><span :data-testid="`scenario-${item.value}`">{{ item.label }}</span></template
          >
        </LabeledSelect>
        <UButton
          color="neutral"
          variant="outline"
          :disabled="optimistic.saving.value || loading"
          data-testid="reload-progression"
          @click="load"
          >Reload saved data</UButton
        >
        <UButton
          color="neutral"
          variant="outline"
          :disabled="optimistic.saving.value || loading"
          data-testid="reset-progression"
          @click="reset"
          >Reset examples</UButton
        >
      </div>
      <p v-if="loading" role="status">Loading characters…</p>
      <UButton v-else-if="loadFailed" data-testid="retry-progression" @click="load"
        >Retry loading characters</UButton
      >
      <p v-else-if="!snapshot.characters.length" data-testid="progression-empty">
        No characters available.
      </p>
      <ProgressionWorkspace
        v-else
        v-model:selected-id="selectedId"
        :snapshot="snapshot"
        :player-character-id="playerCharacterId"
        :read-only="readOnly || optimistic.paused.value"
        :levels="levels"
        @change-class="changeClass"
        @change-skill="changeSkill"
        @change-experience="changeExperience"
        @change-level="changeLevel"
      />
    </div>
  </main>
</template>
