<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useCharacterQuery, useSaveCharacterMutation } from "./hooks";
import { useOptimisticSave } from "../../shared/useOptimisticSave";

type Entry = { id: string; name: string; notes: string };
type Equipment = Entry & {
  kind: "other" | "weapon" | "armor" | "shield";
  priceZenit: number | null;
  equipped?: boolean;
  fixedDefense?: number | null;
  defenseBonus?: number;
  magicDefenseBonus?: number;
  initiativeModifier?: number;
  accuracyDice?: [string | null, string | null];
  accuracyBonus?: number | null;
};
type Sheet = {
  name: string;
  theme: string | null;
  level: number;
  baseDice: Record<string, number>;
  classes: Entry[];
  skills: Entry[];
  equipment: Equipment[];
  resources: { hp: number; mp: number; ip: number; fabula: number };
  overrides: {
    maxHp: number | null;
    maxMp: number | null;
    maxIp: number | null;
    defense: number | null;
    magicDefense: number | null;
    initiative: number | null;
  };
};
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
const derived = computed(() => snapshot.value?.character.derived ?? {});
const maxima = computed(() => derived.value.maxima ?? { hp: 0, mp: 0, ip: 0 });
const defenses = computed(() => derived.value.defenses ?? {});
function submit(changes: Record<string, unknown>) {
  if (!locked.value && sheet.value) optimistic.submit(changes);
}
function setResource(key: keyof Sheet["resources"], event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  if (raw.trim() === "") return;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return;
  submit({ resources: { [key]: value } });
}
function setOverride(key: keyof Sheet["overrides"], event: Event) {
  const value = (event.target as HTMLInputElement).value;
  submit({ overrides: { [key]: value === "" ? null : Number(value) } });
}
function toggleLock() {
  locked.value = !locked.value;
  localStorage.setItem(`character-lock:${characterId.value}`, locked.value ? "1" : "0");
}
function updateEntry(
  kind: "classes" | "skills" | "equipment",
  id: string,
  changes: Partial<Entry | Equipment>,
) {
  if (!sheet.value) return;
  const entries = sheet.value[kind].map((item: Entry | Equipment) =>
    item.id === id ? { ...item, ...changes } : item,
  );
  submit({ [kind]: entries });
}
function add(kind: "classes" | "skills" | "equipment") {
  if (!sheet.value) return;
  const entry =
    kind === "equipment"
      ? {
          id: crypto.randomUUID(),
          name: "New equipment",
          notes: "",
          kind: "other" as const,
          priceZenit: null,
        }
      : {
          id: crypto.randomUUID(),
          name: kind === "classes" ? "New class" : "New skill",
          notes: "",
        };
  submit({ [kind]: [...sheet.value[kind], entry] });
}
function remove(kind: "classes" | "skills" | "equipment", id: string) {
  if (sheet.value && window.confirm("Remove this entry?"))
    submit({ [kind]: sheet.value[kind].filter((entry: Entry) => entry.id !== id) });
}
function changeKind(entry: Equipment, event: Event) {
  const kind = (event.target as HTMLSelectElement).value as Equipment["kind"];
  const common = {
    id: entry.id,
    name: entry.name,
    notes: entry.notes,
    kind,
    priceZenit: entry.priceZenit,
  };
  const variant =
    kind === "weapon"
      ? {
          equipped: false,
          accuracyDice: [null, null] as [string | null, string | null],
          accuracyBonus: null,
        }
      : kind === "armor"
        ? {
            equipped: false,
            fixedDefense: null,
            defenseBonus: 0,
            magicDefenseBonus: 0,
            initiativeModifier: 0,
          }
        : kind === "shield"
          ? { equipped: false, defenseBonus: 0, magicDefenseBonus: 0, initiativeModifier: 0 }
          : {};
  submit({
    equipment: sheet.value?.equipment.map((item) =>
      item.id === entry.id ? { ...common, ...variant } : item,
    ),
  });
}
function retry() {
  void query.refetch();
}
</script>

<template>
  <main
    class="mx-auto max-w-5xl space-y-small rounded-panel border border-default bg-default p-medium"
  >
    <div class="flex items-center justify-between gap-small">
      <RouterLink
        :to="`/games/${gameId}/players/${playerId}`"
        class="text-muted"
        data-testid="player-link"
        >← Player</RouterLink
      ><UButton variant="outline" data-testid="editing-lock" @click="toggleLock">{{
        locked ? "Unlock editing" : "Lock editing"
      }}</UButton>
    </div>
    <p v-if="query.isPending.value && !sheet">Loading character…</p>
    <p v-else-if="query.isError.value && !sheet">
      Could not load character. <UButton variant="outline" @click="retry">Retry</UButton>
    </p>
    <template v-else-if="sheet">
      <header class="grid gap-small border-b border-default pb-small sm:grid-cols-[1.5fr_1fr_auto]">
        <input
          :value="sheet.name"
          data-testid="character-name"
          :disabled="locked"
          class="field text-heading font-semibold"
          @input="submit({ name: ($event.target as HTMLInputElement).value })"
        /><input
          :value="sheet.theme ?? ''"
          placeholder="Theme"
          data-testid="character-theme"
          :disabled="locked"
          class="field"
          @input="submit({ theme: ($event.target as HTMLInputElement).value || null })"
        /><label
          >Level<input
            :value="sheet.level"
            type="number"
            min="5"
            max="50"
            :disabled="locked"
            class="field w-20"
            @change="submit({ level: Number(($event.target as HTMLInputElement).value) })"
        /></label>
      </header>
      <section
        class="grid gap-small rounded-panel border border-default p-small sm:grid-cols-2"
        aria-label="Attributes and resources"
      >
        <div>
          <h2 class="font-semibold">Attributes</h2>
          <div class="grid grid-cols-2 gap-small sm:grid-cols-4">
            <label v-for="attribute in ['DEX', 'INS', 'MIG', 'WLP']" :key="attribute"
              >{{ attribute
              }}<select
                :value="sheet.baseDice[attribute]"
                :disabled="locked"
                class="field"
                @change="
                  submit({
                    baseDice: { [attribute]: Number(($event.target as HTMLSelectElement).value) },
                  })
                "
              >
                <option v-for="die in [6, 8, 10, 12]" :key="die" :value="die">d{{ die }}</option>
              </select></label
            >
          </div>
        </div>
        <div>
          <h2 class="font-semibold">Resources</h2>
          <div class="grid grid-cols-2 gap-small">
            <label
              >HP<input
                :value="sheet.resources.hp"
                aria-label="HP"
                data-testid="character-hp"
                type="number"
                :disabled="locked"
                class="field"
                @input="setResource('hp', $event)"
              /><small>max {{ sheet.overrides.maxHp ?? maxima.hp }}</small></label
            ><label
              >MP<input
                :value="sheet.resources.mp"
                aria-label="MP"
                type="number"
                :disabled="locked"
                class="field"
                @input="setResource('mp', $event)"
              /><small>max {{ sheet.overrides.maxMp ?? maxima.mp }}</small></label
            ><label
              >IP<input
                :value="sheet.resources.ip"
                aria-label="IP"
                type="number"
                :disabled="locked"
                class="field"
                @input="setResource('ip', $event)"
              /><small>max {{ sheet.overrides.maxIp ?? maxima.ip }}</small></label
            ><label
              >Fabula<input
                :value="sheet.resources.fabula"
                aria-label="Fabula"
                type="number"
                :disabled="locked"
                class="field"
                @input="setResource('fabula', $event)"
            /></label>
          </div>
        </div>
      </section>
      <section
        class="grid gap-small rounded-panel border border-default p-small sm:grid-cols-2"
        aria-label="Classes and skills"
      >
        <div v-for="kind in ['classes', 'skills']" :key="kind">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ kind }}</h2>
            <UButton
              size="sm"
              :disabled="locked || (kind === 'classes' && sheet.classes.length >= 2)"
              @click="add(kind as 'classes' | 'skills')"
              >Add</UButton
            >
          </div>
          <div
            v-for="entry in sheet[kind]"
            :key="entry.id"
            class="mt-small grid gap-small sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              :value="entry.name"
              :disabled="locked"
              class="field"
              @change="
                updateEntry(kind as 'classes' | 'skills', entry.id, {
                  name: ($event.target as HTMLInputElement).value,
                })
              "
            /><input
              :value="entry.notes"
              :disabled="locked"
              placeholder="Notes"
              class="field"
              @change="
                updateEntry(kind as 'classes' | 'skills', entry.id, {
                  notes: ($event.target as HTMLInputElement).value,
                })
              "
            /><UButton
              variant="outline"
              size="sm"
              :disabled="locked"
              @click="remove(kind as 'classes' | 'skills', entry.id)"
              >Remove</UButton
            >
          </div>
        </div>
      </section>
      <section
        class="grid gap-small rounded-panel border border-default p-small sm:grid-cols-2"
        aria-label="Equipment and defense"
      >
        <div>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Equipment</h2>
            <UButton size="sm" :disabled="locked" @click="add('equipment')">Add</UButton>
          </div>
          <div
            v-for="entry in sheet.equipment"
            :key="entry.id"
            class="mt-small space-y-small rounded border border-default p-small"
          >
            <div class="grid gap-small sm:grid-cols-[1fr_auto_auto]">
              <input
                :value="entry.name"
                :disabled="locked"
                class="field"
                @change="
                  updateEntry('equipment', entry.id, {
                    name: ($event.target as HTMLInputElement).value,
                  })
                "
              /><select
                :value="entry.kind"
                :disabled="locked"
                class="field"
                @change="changeKind(entry, $event)"
              >
                <option value="other">Other</option>
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
                <option value="shield">Shield</option></select
              ><UButton
                variant="outline"
                size="sm"
                :disabled="locked"
                @click="remove('equipment', entry.id)"
                >Remove</UButton
              >
            </div>
            <input
              :value="entry.notes"
              :disabled="locked"
              placeholder="Notes"
              class="field w-full"
              @change="
                updateEntry('equipment', entry.id, {
                  notes: ($event.target as HTMLInputElement).value,
                })
              "
            /><label
              >Price<input
                :value="entry.priceZenit ?? ''"
                type="number"
                min="0"
                :disabled="locked"
                class="field"
                @change="
                  updateEntry('equipment', entry.id, {
                    priceZenit: Number(($event.target as HTMLInputElement).value),
                  })
                " /></label
            ><label v-if="entry.kind !== 'other'" class="flex items-center gap-small"
              ><input
                :checked="entry.equipped"
                type="checkbox"
                :disabled="locked"
                @change="
                  updateEntry('equipment', entry.id, {
                    equipped: ($event.target as HTMLInputElement).checked,
                  })
                "
              />
              Equipped</label
            >
            <div v-if="entry.kind === 'weapon'" class="grid grid-cols-3 gap-small">
              <label
                >Accuracy 1<select
                  :value="entry.accuracyDice?.[0] ?? ''"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      accuracyDice: [
                        ($event.target as HTMLSelectElement).value || null,
                        entry.accuracyDice?.[1] ?? null,
                      ],
                    })
                  "
                >
                  <option value="">—</option>
                  <option v-for="attribute in ['DEX', 'INS', 'MIG', 'WLP']" :value="attribute">
                    {{ attribute }}
                  </option>
                </select></label
              ><label
                >Accuracy 2<select
                  :value="entry.accuracyDice?.[1] ?? ''"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      accuracyDice: [
                        entry.accuracyDice?.[0] ?? null,
                        ($event.target as HTMLSelectElement).value || null,
                      ],
                    })
                  "
                >
                  <option value="">—</option>
                  <option v-for="attribute in ['DEX', 'INS', 'MIG', 'WLP']" :value="attribute">
                    {{ attribute }}
                  </option>
                </select></label
              ><label
                >Bonus<input
                  :value="entry.accuracyBonus ?? ''"
                  type="number"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      accuracyBonus: Number(($event.target as HTMLInputElement).value),
                    })
                  "
              /></label>
            </div>
            <div
              v-if="entry.kind === 'armor' || entry.kind === 'shield'"
              class="grid grid-cols-3 gap-small"
            >
              <label
                >Defense<input
                  :value="entry.defenseBonus ?? 0"
                  type="number"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      defenseBonus: Number(($event.target as HTMLInputElement).value),
                    })
                  " /></label
              ><label
                >Magic<input
                  :value="entry.magicDefenseBonus ?? 0"
                  type="number"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      magicDefenseBonus: Number(($event.target as HTMLInputElement).value),
                    })
                  " /></label
              ><label
                >Initiative<input
                  :value="entry.initiativeModifier ?? 0"
                  type="number"
                  :disabled="locked"
                  class="field"
                  @change="
                    updateEntry('equipment', entry.id, {
                      initiativeModifier: Number(($event.target as HTMLInputElement).value),
                    })
                  "
              /></label>
            </div>
            <label v-if="entry.kind === 'armor'"
              >Fixed Defense<input
                :value="entry.fixedDefense ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="
                  updateEntry('equipment', entry.id, {
                    fixedDefense: Number(($event.target as HTMLInputElement).value),
                  })
                "
            /></label>
          </div>
        </div>
        <div>
          <h2 class="font-semibold">Defense</h2>
          <div class="grid gap-small sm:grid-cols-3">
            <label
              >Defense<input
                :value="sheet.overrides.defense ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('defense', $event)"
              /><small>calculated {{ defenses.defense?.calculated ?? "unavailable" }}</small></label
            ><label
              >Magic defense<input
                :value="sheet.overrides.magicDefense ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('magicDefense', $event)"
              /><small
                >calculated {{ defenses.magicDefense?.calculated ?? "unavailable" }}</small
              ></label
            ><label
              >Initiative<input
                :value="sheet.overrides.initiative ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('initiative', $event)"
              /><small
                >calculated {{ defenses.initiative?.calculated ?? "unavailable" }}</small
              ></label
            >
          </div>
          <div class="mt-small grid grid-cols-3 gap-small">
            <label
              >Max HP<input
                :value="sheet.overrides.maxHp ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('maxHp', $event)" /></label
            ><label
              >Max MP<input
                :value="sheet.overrides.maxMp ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('maxMp', $event)" /></label
            ><label
              >Max IP<input
                :value="sheet.overrides.maxIp ?? ''"
                type="number"
                :disabled="locked"
                class="field"
                @change="setOverride('maxIp', $event)"
            /></label>
          </div>
          <UButton
            class="mt-small"
            size="sm"
            variant="outline"
            :disabled="locked"
            @click="submit({ overrides: { defense: null, magicDefense: null, initiative: null } })"
            >Use calculated</UButton
          >
          <details class="mt-small">
            <summary>Breakdown</summary>
            <pre class="text-muted">{{ JSON.stringify(defenses, null, 2) }}</pre>
          </details>
        </div>
      </section>
      <p v-if="optimistic.saving.value" data-testid="save-status" role="status">Saving…</p>
      <p v-else-if="optimistic.error.value" role="alert">
        {{ optimistic.error.value.message }}
        <UButton size="sm" variant="outline" @click="optimistic.retry">Refresh</UButton>
      </p>
      <p v-else data-testid="save-status" role="status">Saved</p>
    </template>
  </main>
</template>
