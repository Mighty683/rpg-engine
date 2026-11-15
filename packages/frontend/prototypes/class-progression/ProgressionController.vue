<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useOptimisticSave } from "../../src/shared/useOptimisticSave";
import { useToast } from "@nuxt/ui/composables";
import { useProgressionApi } from "../../src/modules/class-progression/services";
import type {
  ProgressionSnapshot,
  ProgressionAllocation,
} from "../../src/modules/class-progression/types";
import { progressionError, withProgressionRanks } from "../../src/modules/class-progression/model";
import ProgressionWorkspace from "../../src/modules/class-progression/ProgressionWorkspace.vue";
import LabeledSelect from "../../src/shared/design-system/base/LabeledSelect.vue";
import { resetPrototypeBackend, setPrototypeScenario } from "../api";
import type { PrototypeScenario } from "../api";

const props = defineProps<{ readOnly?: boolean }>();
const api = useProgressionApi();
const toast = useToast();
const optimistic = useOptimisticSave<ProgressionSnapshot, Record<string, ProgressionAllocation>>({
  apply: (base, changes) => ({
    ...base,
    characters: base.characters.map((character) =>
      changes[character.id]
        ? withProgressionRanks(
            base.catalog,
            character,
            changes[character.id]!.ranks,
            changes[character.id]!.levels,
          )
        : character,
    ),
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
const selectedId = ref("catalog-rowan");
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
function submit(allocation: ProgressionAllocation) {
  if (!selected.value || props.readOnly || optimistic.paused.value) return;
  const error = progressionError(snapshot.value.catalog, allocation.levels, allocation.ranks);
  if (error) {
    report(new Error(error));
    return;
  }
  optimistic.submit({ [selected.value.id]: allocation });
}
function changeClass(id: string, delta: number) {
  if (!selected.value) return;
  submit({
    ranks: { ...selected.value.ranks },
    levels: { ...levels.value, [id]: (levels.value[id] ?? 0) + delta },
  });
}
function changeSkill(id: string, delta: number) {
  if (!selected.value) return;
  submit({
    levels: { ...levels.value },
    ranks: { ...selected.value.ranks, [id]: (selected.value.ranks[id] ?? 0) + delta },
  });
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
      <header>
        <p class="text-label text-muted">THE LANTERN ROAD · FABULA ULTIMA</p>
        <h1 class="text-heading font-semibold">Character classes & skills</h1>
        <p class="text-small text-muted">
          Illustrative game-class catalog. Saved within this gallery session; reload or Reset
          restores examples. Skill effects are sample definitions, not official rules.
        </p>
      </header>
      <div class="flex flex-wrap items-end gap-medium">
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
        No characters available. Reset examples to review selection and progression.
      </p>
      <ProgressionWorkspace
        v-else
        v-model:selected-id="selectedId"
        :snapshot="snapshot"
        :read-only="readOnly || optimistic.paused.value"
        :levels="levels"
        @change-class="changeClass"
        @change-skill="changeSkill"
      />
    </div>
  </main>
</template>
