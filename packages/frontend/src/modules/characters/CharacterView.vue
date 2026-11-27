<script setup lang="ts">
import { tr } from "../../shared/i18n";
import CharacterSheetSkeleton from "./sheet/CharacterSheetSkeleton.vue";
import AbilitiesSkeleton from "../class-progression/AbilitiesSkeleton.vue";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import type { CharacterEdit, Snapshot } from "./types";
import type { Sheet } from "./sheet/types";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  useGameCharacterQuery,
  useGameCharactersQuery,
  useSaveGameCharacterMutation,
} from "./hooks";
import CharacterSheet from "./sheet/CharacterSheet.vue";
import { toCharacter, toSheet } from "./sheet/model";
import type { Character as SheetCharacter } from "./sheet/types";
import { useOptimisticSave } from "../../shared/useOptimisticSave";
import CharacterAbilities from "../class-progression/CharacterAbilities.vue";
import ExperienceFields from "../class-progression/ExperienceFields.vue";
import GameContextLink from "../games/GameContextLink.vue";
import { useGameEvents } from "../games/useGameEvents";
import { useGameClassCatalogQuery } from "../class-progression/hooks";
import {
  experienceError,
  managedAbilities,
  previewManagedProgression,
  progressionError,
  projectClassStats,
  sourcedBenefits,
} from "../class-progression/model";
import type { ManagedProgression, ProgressionExperience } from "../class-progression/types";

const toast = useToast();
const route = useRoute();
const props = defineProps<{ gameId?: string; characterId?: string; readOnly?: boolean }>();
const gameId = computed(() => props.gameId ?? String(route.params.gameId));
const characterId = computed(() => props.characterId ?? String(route.params.characterId));
const query = useGameCharacterQuery(gameId.value, characterId.value);
useQueryErrorToast(query, tr("ui.couldNotLoadCharacterTryAgainOrReturnTo"));
const roster = useGameCharactersQuery(gameId.value);
if (!props.gameId) useQueryErrorToast(roster, tr("ui.couldNotLoadCharacterAccessTryAgain"));
const mutation = useSaveGameCharacterMutation(gameId.value, characterId.value);
const snapshot = ref<Snapshot | null>(null);
const catalogQuery = useGameClassCatalogQuery(
  gameId.value,
  computed(() => Boolean(snapshot.value?.character.progression)),
);
useQueryErrorToast(catalogQuery, tr("ui.couldNotLoadClassesTryAgain"));
const catalog = computed(() => catalogQuery.data.value ?? []);

function refreshSheet() {
  void query.refetch();
  void roster.refetch();
  if (snapshot.value?.character.progression) void catalogQuery.refetch();
}
useGameEvents(
  props.gameId ? undefined : gameId.value,
  (hint) => {
    if (hint.type === "sheet" && hint.characterId === characterId.value.toLowerCase())
      void query.refetch();
    if (hint.type === "roster") refreshSheet();
  },
  refreshSheet,
);

function mergeSheet(base: Sheet, changes: Record<string, unknown>) {
  return {
    ...base,
    ...changes,
    baseDice: { ...base.baseDice, ...(changes.baseDice as object | undefined) },
    resources: { ...base.resources, ...(changes.resources as object | undefined) },
    overrides: { ...base.overrides, ...(changes.overrides as object | undefined) },
  } as Sheet;
}
function applyEdit(
  base: Snapshot,
  { progression: change, ...sheetChanges }: CharacterEdit,
): Snapshot {
  const sheet = mergeSheet(base.character.sheet, sheetChanges);
  const stored = base.character.progression;
  if (!stored) return { character: { ...base.character, sheet } };
  const progression = change ? previewManagedProgression(stored, change) : stored;
  const { ranks, levels } = managedAbilities(progression);
  const derived =
    catalogQuery.data.value || !progression.classLevels.length
      ? {
          ...base.character.derived,
          ...projectClassStats(sheet, sourcedBenefits(catalog.value, ranks, levels)),
        }
      : base.character.derived;
  return { character: { ...base.character, sheet, progression, derived } };
}

function mergeEdits(a: CharacterEdit, b: CharacterEdit): CharacterEdit {
  return {
    ...a,
    ...b,
    baseDice: { ...(a.baseDice as object | undefined), ...(b.baseDice as object | undefined) },
    resources: { ...(a.resources as object | undefined), ...(b.resources as object | undefined) },
    overrides: { ...(a.overrides as object | undefined), ...(b.overrides as object | undefined) },
  };
}

const optimistic = useOptimisticSave<Snapshot, CharacterEdit[]>({
  initial: snapshot,
  apply: (base, edits) => edits.reduce(applyEdit, base),
  async save(base, edits) {
    let latest = base;
    try {
      for (const changes of edits) {
        latest = (await mutation.mutateAsync({
          expectedRevision: latest.character.revision,
          changes,
        })) as unknown as Snapshot;
      }
    } catch (error) {
      if (latest === base) throw error;
      throw new Error(tr("ui.someEditsMayHaveBeenSavedReloadTheLatest"));
    }
    return latest;
  },
  refresh: async () => {
    const result = await query.refetch();
    if (result.isError || !result.data) throw new Error(tr("ui.characterCouldNotBeRefreshed"));
    return result.data as unknown as Snapshot;
  },
  merge: (a, b) => {
    const last = a.at(-1)!;
    const next = b[0]!;
    // EXP is entered before the allocation delta. Keep progression edits in submission order.
    if (last.progression || next.progression) return [...a, ...b];
    return [...a.slice(0, -1), mergeEdits(last, next), ...b.slice(1)];
  },
  isKnownRejection: (error) => error.status === 400 || error.status === 422,
});
watch(optimistic.error, (error) => {
  if (!error) return;
  const message =
    error.status === 403
      ? tr("ui.yourEditAccessChangedYourLocalDraftIsPreserved")
      : error.status === 400 || error.status === 422
        ? tr("ui.theChangeWasRejectedAndHasBeenReverted")
        : tr("ui.yourChangesCouldNotBeConfirmedYourLocalDraft");
  const reload = {
    label: tr("ui.reloadSavedSheet"),
    "data-testid": "reload-saved-sheet",
    onClick: () => void optimistic.retry(),
  };
  toast.add({ title: message, color: "error", actions: optimistic.paused.value ? [reload] : [] });
});
watch(
  [() => query.data.value, optimistic.saving],
  ([value, saving]) => {
    if (!value || saving) return;
    const next = value as unknown as Snapshot;
    if (next.character.revision >= (optimistic.acknowledged.value?.character.revision ?? 0))
      optimistic.setSnapshot(next);
  },
  { immediate: true },
);
watch(
  () => optimistic.displayed.value,
  (value) => {
    if (value) snapshot.value = value;
  },
  { deep: true },
);
const sheet = computed(() => snapshot.value?.character.sheet);
const rosterCharacter = computed(() =>
  roster.data.value?.characters.find((character) => character.id === characterId.value),
);
const readAccessLost = computed(() => {
  const queryStatus = (query.error.value as { status?: number } | null)?.status;
  const saveStatus = optimistic.error.value?.status;
  return queryStatus === 401 || queryStatus === 404 || saveStatus === 401 || saveStatus === 404;
});
const effectiveReadOnly = computed(() => {
  const canEdit = rosterCharacter.value?.canEdit;
  return (
    props.readOnly ||
    !canEdit ||
    snapshot.value?.character.canEdit === false ||
    optimistic.error.value?.status === 403
  );
});
const draft = ref<SheetCharacter | null>(null);
let syncedDraft = "";
watch(
  sheet,
  (value) => {
    if (!value) return;
    if (draft.value && JSON.stringify(toSheet(draft.value, value)) === JSON.stringify(value))
      return;
    draft.value = toCharacter(value, characterId.value);
    syncedDraft = JSON.stringify(draft.value);
  },
  { immediate: true },
);
watch(
  draft,
  (value) => {
    const current = sheet.value;
    if (!value || !current) return;
    if (JSON.stringify(value) === syncedDraft) return;
    syncedDraft = JSON.stringify(value);
    if (effectiveReadOnly.value) return;
    const updated = toSheet(value, current);
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(updated) as (keyof Sheet)[]) {
      if (JSON.stringify(updated[key]) !== JSON.stringify(current[key]))
        changes[key] = updated[key];
    }
    if (Object.keys(changes).length) optimistic.submit([changes]);
  },
  { deep: true },
);
const derived = computed(() => snapshot.value?.character.derived ?? {});
const maximum = computed(() => ({
  HP: derived.value.currentDice
    ? (derived.value.maxima?.hp ?? 0)
    : (sheet.value?.overrides.maxHp ?? derived.value.maxima?.hp ?? 0),
  MP: derived.value.currentDice
    ? (derived.value.maxima?.mp ?? 0)
    : (sheet.value?.overrides.maxMp ?? derived.value.maxima?.mp ?? 0),
  IP: derived.value.currentDice
    ? (derived.value.maxima?.ip ?? 0)
    : (sheet.value?.overrides.maxIp ?? derived.value.maxima?.ip ?? 0),
}));
const maximumOverrides = computed(() => ({
  HP: sheet.value?.overrides.maxHp ?? null,
  MP: sheet.value?.overrides.maxMp ?? null,
  IP: sheet.value?.overrides.maxIp ?? null,
}));
function overrideMaximum(resource: "HP" | "MP" | "IP", value: number | null) {
  const keys = { HP: "maxHp", MP: "maxMp", IP: "maxIp" } as const;
  if (!effectiveReadOnly.value) optimistic.submit([{ overrides: { [keys[resource]]: value } }]);
}
const defenseKeys = { DEF: "defense", "MAG DEF": "magicDefense", INIT: "initiative" } as const;
const baseDefense = computed(
  () =>
    Object.fromEntries(
      Object.entries(defenseKeys).map(([label, key]) => [
        label,
        derived.value.defenses?.[key]?.calculated ?? null,
      ]),
    ) as Record<keyof typeof defenseKeys, number | null>,
);
const defenseDetails = computed(() => {
  return Object.fromEntries(
    Object.entries(defenseKeys).map(([label, key]) => {
      const contributions = derived.value.defenses?.[key]?.contributions ?? [];
      const details = contributions.flatMap(
        (part: { source: string; entryId?: string; value: number }, index: number) => {
          const entry = sheet.value?.equipment.find((item) => item.id === part.entryId);
          const fixedBase =
            key === "defense" &&
            index === 0 &&
            entry?.kind === "armor" &&
            entry.fixedDefense !== null;
          const modifier =
            !fixedBase &&
            (part.source === "armor" || part.source === "shield" || part.source === "class");
          if (modifier && part.value === 0) return [];
          const name =
            entry?.name ?? (part.source === "class" ? tr("ui.classEffects") : part.source);
          return [{ name: fixedBase ? `${name} (fixed)` : name, value: part.value, modifier }];
        },
      );
      if (key === "initiative" && baseDefense.value.INIT !== null)
        details.unshift({ name: tr("ui.base"), value: 0, modifier: false });
      return [label, details];
    }),
  ) as Record<keyof typeof defenseKeys, { name: string; value: number; modifier?: boolean }[]>;
});
const savedSheet = computed(() => optimistic.latestSaved.value?.character.sheet);
const savedDraft = computed(() =>
  savedSheet.value ? toCharacter(savedSheet.value, characterId.value) : null,
);
const savedDerived = computed(() => optimistic.latestSaved.value?.character.derived ?? {});
const savedMaximum = computed(() => ({
  HP: savedDerived.value.currentDice
    ? (savedDerived.value.maxima?.hp ?? 0)
    : (savedSheet.value?.overrides.maxHp ?? savedDerived.value.maxima?.hp ?? 0),
  MP: savedDerived.value.currentDice
    ? (savedDerived.value.maxima?.mp ?? 0)
    : (savedSheet.value?.overrides.maxMp ?? savedDerived.value.maxima?.mp ?? 0),
  IP: savedDerived.value.currentDice
    ? (savedDerived.value.maxima?.ip ?? 0)
    : (savedSheet.value?.overrides.maxIp ?? savedDerived.value.maxima?.ip ?? 0),
}));
const savedOverrides = computed(() => ({
  HP: savedSheet.value?.overrides.maxHp ?? null,
  MP: savedSheet.value?.overrides.maxMp ?? null,
  IP: savedSheet.value?.overrides.maxIp ?? null,
}));
const savedDefense = computed(
  () =>
    Object.fromEntries(
      Object.entries(defenseKeys).map(([label, key]) => [
        label,
        savedDerived.value.defenses?.[key]?.calculated ?? null,
      ]),
    ) as Record<keyof typeof defenseKeys, number | null>,
);
const emptyDefenseDetails = { DEF: [], "MAG DEF": [], INIT: [] };
const progression = computed(() => snapshot.value?.character.progression);
const abilities = computed(() => progression.value && managedAbilities(progression.value));
const progressionBusy = computed(() => optimistic.saving.value || optimistic.paused.value);

function editProgression(changes: Partial<ManagedProgression>) {
  if (!progression.value || effectiveReadOnly.value || progressionBusy.value) return;
  const next = managedAbilities(previewManagedProgression(progression.value, changes));
  const message =
    experienceError(next.experience, next.levels) ??
    (changes.classLevels || changes.skillRanks
      ? progressionError(catalog.value, next.levels, next.ranks)
      : undefined);
  if (message) {
    toast.add({ title: message, color: "error" });
    return;
  }
  optimistic.submit([{ progression: changes }]);
}
function changeExperience(field: keyof ProgressionExperience, value: number) {
  if (abilities.value)
    editProgression({ experience: { ...abilities.value.experience, [field]: value } });
}
function changeClass(id: string, delta: number) {
  if (!abilities.value) return;
  const { levels } = abilities.value;
  const classLevels = Object.entries({ ...levels, [id]: (levels[id] ?? 0) + delta })
    .filter(([, level]) => level > 0)
    .map(([gameClassId, level]) => ({ gameClassId, level }));
  editProgression({ classLevels });
}
function changeSkill(id: string, delta: number) {
  if (!abilities.value) return;
  const { ranks } = abilities.value;
  const skillRanks = Object.entries({ ...ranks, [id]: (ranks[id] ?? 0) + delta })
    .filter(([, rank]) => rank > 0)
    .map(([skillId, rank]) => ({ skillId, rank }));
  editProgression({ skillRanks });
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-small">
    <GameContextLink v-if="!props.gameId" :game-id="gameId" />
    <p
      v-if="draft && rosterCharacter"
      data-testid="character-controller"
      class="text-small text-muted"
    >
      {{
        rosterCharacter.controllerMembershipId
          ? tr("ui.controlledByValue1", { value1: rosterCharacter.controllerName })
          : tr("ui.controlledByTheGm")
      }}.
      <span v-if="effectiveReadOnly">{{ tr("ui.youCanViewThisSheetButCannotEditIt") }}</span>
    </p>
    <UButton v-if="readAccessLost" to="/" color="neutral" variant="outline">{{
      tr("ui.myGames")
    }}</UButton>
    <SkeletonRegion v-else-if="query.isPending.value && !draft" :label="tr('ui.loadingCharacter')"
      ><CharacterSheetSkeleton
    /></SkeletonRegion>
    <ContentState v-else-if="query.isError.value && !draft" kind="error" @retry="query.refetch" />
    <CharacterSheet
      v-else-if="draft"
      :character="draft"
      :read-only="effectiveReadOnly"
      :current-dice="derived.currentDice"
      :maximum="maximum"
      :maximum-overrides="maximumOverrides"
      @override-maximum="overrideMaximum"
      :base-defense="baseDefense"
      :defense-details="defenseDetails"
    >
      <template v-if="abilities" #experience>
        <ExperienceFields
          :experience="abilities.experience"
          :read-only="effectiveReadOnly"
          :disabled="progressionBusy"
          @change="changeExperience"
        />
      </template>
      <template v-if="abilities" #class-progression>
        <AbilitiesSkeleton v-if="catalogQuery.isLoading.value" />
        <ContentState
          v-else-if="catalogQuery.isError.value"
          kind="error"
          :retry-label="tr('ui.retryLoadingClasses')"
          @retry="catalogQuery.refetch"
        />
        <CharacterAbilities
          v-else
          :catalog="catalog"
          :character="abilities"
          :read-only="effectiveReadOnly"
          :saving="progressionBusy"
          @change-class="changeClass"
          @change-skill="changeSkill"
        />
      </template>
    </CharacterSheet>
    <p v-if="optimistic.saving.value" data-testid="save-status" role="status">
      {{ tr("ui.saving") }}
    </p>
    <div
      v-else-if="optimistic.error.value"
      data-testid="save-status"
      role="alert"
      class="space-y-small"
    >
      <p v-if="optimistic.paused.value" data-testid="save-conflict-message">
        {{ tr("ui.yourChangesCouldNotBeConfirmedYourLocalDraft2") }}
      </p>
      <p v-else>{{ tr("ui.theChangeWasRejectedAndHasBeenReverted") }}</p>
      <UButton
        v-if="optimistic.paused.value"
        color="neutral"
        variant="outline"
        @click="optimistic.retry"
        data-testid="discard-draft-and-reload"
        >{{ tr("ui.discardDraftAndReload") }}</UButton
      >
    </div>
    <p
      v-else-if="draft && !effectiveReadOnly"
      class="text-small text-muted"
      data-testid="save-status"
      role="status"
    >
      {{ tr("ui.savedAutomatically") }}
    </p>
    <details v-if="optimistic.paused.value && savedDraft && !readAccessLost" class="space-y-small">
      <summary class="cursor-pointer font-semibold">
        {{ tr("ui.reviewLatestSavedVersion") }}
      </summary>
      <CharacterSheet
        :character="savedDraft"
        :current-dice="savedDerived.currentDice"
        read-only
        :maximum="savedMaximum"
        :maximum-overrides="savedOverrides"
        :base-defense="savedDefense"
        :defense-details="emptyDefenseDetails"
      />
    </details>
  </div>
</template>
