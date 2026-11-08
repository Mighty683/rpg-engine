<script setup lang="ts">
import ContentState from "../../shared/design-system/ContentState.vue";
import { useToast } from "@nuxt/ui/composables";
import { useQueryErrorToast } from "../../shared/useQueryErrorToast";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useGameCharacterQuery, useGameCharactersQuery, useSaveGameCharacterMutation } from "./hooks";
import CharacterSheet from "./sheet/CharacterSheet.vue";
import { toCharacter, toSheet, type Sheet } from "./sheet/model";
import type { Character as SheetCharacter } from "./sheet/types";
import { useOptimisticSave } from "../../shared/useOptimisticSave";

type Snapshot = { character: { revision: number; sheet: Sheet; derived: Record<string, any> } };

const toast = useToast();
const route = useRoute();
const props = defineProps<{ gameId?: string; characterId?: string; readOnly?: boolean }>();
const gameId = computed(() => props.gameId ?? String(route.params.gameId));
const characterId = computed(() => props.characterId ?? String(route.params.characterId));
const query = useGameCharacterQuery(gameId.value, characterId.value);
useQueryErrorToast(query, "Could not load character. Try again or return to your games.");
const roster = useGameCharactersQuery(gameId.value);
if (!props.gameId) useQueryErrorToast(roster, "Could not load character access. Try again.");
const mutation = useSaveGameCharacterMutation(gameId.value, characterId.value);
const snapshot = ref<Snapshot | null>(null);
const locked = ref(localStorage.getItem(`character-lock:${characterId.value}`) === "1");
function mergeSheet(base: Sheet, changes: Record<string, unknown>) {
  return {
    ...base,
    ...changes,
    baseDice: { ...base.baseDice, ...(changes.baseDice as object | undefined) },
    resources: { ...base.resources, ...(changes.resources as object | undefined) },
    overrides: { ...base.overrides, ...(changes.overrides as object | undefined) },
  } as Sheet;
}
const optimistic = useOptimisticSave<Snapshot, Record<string, unknown>>({
  initial: snapshot,
  apply: (base, changes) => ({
    character: { ...base.character, sheet: mergeSheet(base.character.sheet, changes) },
  }),
  save: (base, changes) =>
    mutation.mutateAsync({
      expectedRevision: base.character.revision,
      changes,
    }) as unknown as Promise<Snapshot>,
  refresh: async () => {
    const result = await query.refetch();
    if (!result.data) throw new Error("Character could not be refreshed");
    return result.data as unknown as Snapshot;
  },
  merge: (a, b) => ({
    ...a,
    ...b,
    baseDice: { ...(a.baseDice as object | undefined), ...(b.baseDice as object | undefined) },
    resources: { ...(a.resources as object | undefined), ...(b.resources as object | undefined) },
    overrides: { ...(a.overrides as object | undefined), ...(b.overrides as object | undefined) },
  }),
  isKnownRejection: (error) => error.status === 400 || error.status === 422,
});
watch(optimistic.error, (error) => {
  if (!error) return;
  const message = error.status === 403
    ? "Your edit access changed. Your local draft is preserved."
    : error.status === 400 || error.status === 422
      ? "The change was rejected and has been reverted."
      : "Your changes could not be confirmed. Your local draft is preserved.";
  toast.add({ title: message, color: "error" });
});
watch(
  () => query.data.value,
  (value) => {
    if (value) {
      const next = value as unknown as Snapshot;
      optimistic.setSnapshot(next);
    }
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
const rosterCharacter = computed(() => roster.data.value?.characters.find((character) => character.id === characterId.value));
const readAccessLost = computed(() => {
  const queryStatus = (query.error.value as { status?: number } | null)?.status;
  const saveStatus = optimistic.error.value?.status;
  return queryStatus === 401 || queryStatus === 404 || saveStatus === 401 || saveStatus === 404;
});
const effectiveReadOnly = computed(() => {
  const canEdit = rosterCharacter.value?.canEdit;
  return props.readOnly || !canEdit || optimistic.error.value?.status === 403;
});
const draft = ref<SheetCharacter | null>(null);
let syncedDraft = "";
watch(
  sheet,
  (value) => {
    if (!value) return;
    if (draft.value && JSON.stringify(toSheet(draft.value, value)) === JSON.stringify(value))
      return;
    draft.value = toCharacter(value, characterId.value, locked.value);
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
    if (value.editingLocked !== locked.value) {
      locked.value = value.editingLocked;
      localStorage.setItem(`character-lock:${characterId.value}`, locked.value ? "1" : "0");
    }
    if (locked.value || effectiveReadOnly.value) return;
    const updated = toSheet(value, current);
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(updated) as (keyof Sheet)[]) {
      if (JSON.stringify(updated[key]) !== JSON.stringify(current[key]))
        changes[key] = updated[key];
    }
    if (Object.keys(changes).length) optimistic.submit(changes);
  },
  { deep: true },
);
const derived = computed(() => snapshot.value?.character.derived ?? {});
const maximum = computed(() => ({
  HP: sheet.value?.overrides.maxHp ?? derived.value.maxima?.hp ?? 0,
  MP: sheet.value?.overrides.maxMp ?? derived.value.maxima?.mp ?? 0,
  IP: sheet.value?.overrides.maxIp ?? derived.value.maxima?.ip ?? 0,
}));
const maximumOverrides = computed(() => ({
  HP: sheet.value?.overrides.maxHp ?? null,
  MP: sheet.value?.overrides.maxMp ?? null,
  IP: sheet.value?.overrides.maxIp ?? null,
}));
function overrideMaximum(resource: "HP" | "MP" | "IP", value: number | null) {
  const keys = { HP: "maxHp", MP: "maxMp", IP: "maxIp" } as const;
  if (!locked.value && !effectiveReadOnly.value) optimistic.submit({ overrides: { [keys[resource]]: value } });
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
          const modifier = !fixedBase && (part.source === "armor" || part.source === "shield");
          if (modifier && part.value === 0) return [];
          const name = entry?.name ?? part.source;
          return [{ name: fixedBase ? `${name} (fixed)` : name, value: part.value, modifier }];
        },
      );
      if (key === "initiative" && baseDefense.value.INIT !== null)
        details.unshift({ name: "Base", value: 0, modifier: false });
      return [label, details];
    }),
  ) as Record<keyof typeof defenseKeys, { name: string; value: number; modifier?: boolean }[]>;
});
const savedSheet = computed(() => optimistic.latestSaved.value?.character.sheet);
const savedDraft = computed(() => savedSheet.value ? toCharacter(savedSheet.value, characterId.value, true) : null);
const savedDerived = computed(() => optimistic.latestSaved.value?.character.derived ?? {});
const savedMaximum = computed(() => ({
  HP: savedSheet.value?.overrides.maxHp ?? savedDerived.value.maxima?.hp ?? 0,
  MP: savedSheet.value?.overrides.maxMp ?? savedDerived.value.maxima?.mp ?? 0,
  IP: savedSheet.value?.overrides.maxIp ?? savedDerived.value.maxima?.ip ?? 0,
}));
const savedOverrides = computed(() => ({
  HP: savedSheet.value?.overrides.maxHp ?? null,
  MP: savedSheet.value?.overrides.maxMp ?? null,
  IP: savedSheet.value?.overrides.maxIp ?? null,
}));
const savedDefense = computed(() => Object.fromEntries(Object.entries(defenseKeys).map(([label, key]) => [label, savedDerived.value.defenses?.[key]?.calculated ?? null])) as Record<keyof typeof defenseKeys, number | null>);
const emptyDefenseDetails = { DEF: [], "MAG DEF": [], INIT: [] };
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-small">
    <p v-if="draft && rosterCharacter" data-testid="character-controller" class="text-sm text-muted">
      {{ rosterCharacter.controllerMembershipId ? `Controlled by ${rosterCharacter.controllerName}` : "Controlled by the GM" }}.
      <span v-if="effectiveReadOnly">You can view this sheet but cannot edit it.</span>
    </p>
    <UButton v-if="readAccessLost" to="/" color="neutral" variant="outline">My games</UButton>
    <ContentState v-else-if="query.isPending.value && !draft" kind="loading">Loading character…</ContentState>
    <ContentState v-else-if="query.isError.value && !draft" kind="error" @retry="query.refetch" />
    <CharacterSheet
      v-else-if="draft"
      :character="draft"
      :read-only="effectiveReadOnly"
      :maximum="maximum"
      :maximum-overrides="maximumOverrides"
      @override-maximum="overrideMaximum"
      :base-defense="baseDefense"
      :defense-details="defenseDetails"
    />
    <p v-if="optimistic.saving.value" data-testid="save-status" role="status">Saving…</p>
    <div v-else-if="optimistic.error.value" data-testid="save-status" role="alert" class="space-y-small">
      <p v-if="optimistic.paused.value">Your changes could not be confirmed. Your local draft is shown above.</p>
      <p v-else>The change was rejected and has been reverted.</p>
      <UButton v-if="optimistic.paused.value" color="neutral" variant="outline" @click="optimistic.retry"
        >Discard draft and reload</UButton
      >
    </div>
    <p v-else-if="draft && !effectiveReadOnly" class="text-sm text-muted" data-testid="save-status" role="status">Saved automatically</p>
    <details v-if="optimistic.paused.value && savedDraft && !readAccessLost" class="space-y-small">
      <summary class="cursor-pointer font-semibold">Review latest saved version</summary>
      <CharacterSheet :character="savedDraft" read-only :maximum="savedMaximum" :maximum-overrides="savedOverrides" :base-defense="savedDefense" :defense-details="emptyDefenseDetails" />
    </details>
  </div>
</template>
