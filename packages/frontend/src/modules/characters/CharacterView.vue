<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useCharacterQuery, useSaveCharacterMutation } from "./hooks";
import CharacterSheet from "./sheet/CharacterSheet.vue";
import { toCharacter, toSheet, type Sheet } from "./sheet/model";
import type { Character as SheetCharacter } from "./sheet/types";
import { useOptimisticSave } from "../../shared/useOptimisticSave";

type Snapshot = { character: { revision: number; sheet: Sheet; derived: Record<string, any> } };

const route = useRoute();
const gameId = computed(() => String(route.params.gameId));
const playerId = computed(() => String(route.params.playerId));
const characterId = computed(() => String(route.params.characterId));
const query = useCharacterQuery(gameId.value, playerId.value, characterId.value);
const mutation = useSaveCharacterMutation(gameId.value, playerId.value, characterId.value);
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
watch(
  () => query.data.value,
  (value) => {
    if (value && !optimistic.saving.value && !optimistic.pending.value) {
      const next = value as unknown as Snapshot;
      snapshot.value = next;
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
    if (locked.value) return;
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
  if (!locked.value) optimistic.submit({ overrides: { [keys[resource]]: value } });
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
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-small">
    <p v-if="query.isPending.value && !draft">Loading character…</p>
    <p v-else-if="query.isError.value && !draft">
      Could not load character. <UButton color="neutral" variant="outline" @click="query.refetch">Retry</UButton>
    </p>
    <CharacterSheet
      v-else-if="draft"
      :character="draft"
      :maximum="maximum"
      :maximum-overrides="maximumOverrides"
      @override-maximum="overrideMaximum"
      :base-defense="baseDefense"
      :defense-details="defenseDetails"
    />
    <p v-if="optimistic.saving.value" data-testid="save-status" role="status">Saving…</p>
    <p v-else-if="optimistic.error.value" role="alert">
      {{ optimistic.error.value.message }}
      <UButton v-if="optimistic.paused.value" color="neutral" variant="outline" @click="optimistic.retry"
        >Reload</UButton
      >
    </p>
    <p v-else-if="draft" class="sr-only" data-testid="save-status" role="status">Saved</p>
  </div>
</template>
