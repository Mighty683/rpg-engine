<script setup lang="ts">
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { useApiServices } from "../../shared/api-services";
import type { Attribute } from "../game-table/types";
import type { GmNpc, NpcRead, NpcWrite } from "./api";
import type { Npc, NpcAttack } from "./types";
import NpcCard from "./NpcCard.vue";
import NpcSheet from "./NpcSheet.vue";
import CharacterSheetTabs from "../game-table/CharacterSheetTabs.vue";

const props = defineProps<{
  gameId: string;
  role: "GM" | "Player";
  hint: number;
  panelsBlocked?: boolean;
  externalTabs?: boolean;
  openRequest?: number;
  closeRequest?: number;
}>();
const emit = defineEmits<{
  rollAttribute: [npc: GmNpc, attribute: Attribute];
  rollAttack: [npc: GmNpc, attack: NpcAttack];
  changed: [npcs: GmNpc[]];
  editorOpen: [open: boolean];
}>();
const api = useApiServices().npcs;
const toast = useToast();
const records = ref<NpcRead[]>([]);
const selected = ref("");
const panelOpen = ref(false);
watch(panelOpen, (open) => emit("editorOpen", open));
const resetToken = ref(0);
watch(
  records,
  () =>
    emit(
      "changed",
      records.value.filter((npc): npc is GmNpc => npc.view === "gm"),
    ),
  { deep: true },
);
const loading = ref(false);
const creating = ref(false);
const removing = ref(false);
let requestVersion = 0;
const writing = ref(false);
const queued = new Map<string, NpcWrite>();
let refreshPending = false;

function prototypeNpc(record: NpcRead): Npc {
  const profile = record.view === "visible" ? null : record;
  return {
    id: record.id,
    name: record.name,
    relationship: record.relationship,
    level: profile?.level ?? 5,
    visibility: record.view === "gm" ? record.visibility : "known",
    baseDice: profile?.baseDice ?? { DEX: 6, INS: 6, MIG: 6, WLP: 6 },
    hp: profile?.hp ?? { current: 0, max: 0 },
    mp: profile?.mp ?? { current: 0, max: 0 },
    defense: profile?.defense ?? 0,
    magicDefense: profile?.magicDefense ?? 0,
    attacks: profile?.attacks.map(({ reach, ...attack }) => ({ ...attack, range: reach })) ?? [],
    notes: record.view === "gm" ? record.notes : "",
    crisis: 0,
    initiative: 0,
    abilities: [],
    vulnerabilities: [],
    resistances: [],
    immunities: [],
    statusImmunities: [],
    tags: [],
  };
}
function toWrite(npc: Npc): NpcWrite {
  return {
    name: npc.name,
    relationship: npc.relationship ?? "neutral",
    level: npc.level,
    visibility: npc.visibility ?? "hidden",
    baseDice: npc.baseDice,
    hp: npc.hp,
    mp: npc.mp,
    defense: npc.defense,
    magicDefense: npc.magicDefense,
    notes: npc.notes,
    attacks: npc.attacks.map(({ range, ...attack }) => ({ ...attack, reach: range })),
  };
}
const active = computed(() =>
  records.value.find((npc) => npc.id === selected.value && npc.view === "gm"),
);
const selectedNpc = computed(() => (active.value ? prototypeNpc(active.value) : null));
function openEditor(id = "") {
  selected.value = id || records.value.find((npc) => npc.view === "gm")?.id || "";
  panelOpen.value = true;
}
watch(
  () => props.openRequest,
  (request) => {
    if (request) openEditor();
  },
  { immediate: true },
);
watch(
  () => props.closeRequest,
  () => void closeEditor(),
);
function setPanelOpen(open: boolean) {
  if (open) panelOpen.value = true;
  else void closeEditor();
}
async function refresh() {
  const version = ++requestVersion;
  loading.value = true;
  try {
    const data = await api.list(props.gameId);
    if (!Array.isArray(data.npcs)) throw new Error("Invalid NPC response");
    if (version === requestVersion) records.value = data.npcs;
  } catch {
    if (version === requestVersion) {
      records.value = [];
      toast.add({ title: "Could not load NPCs.", color: "error" });
    }
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}
async function create() {
  if (creating.value) return;
  creating.value = true;
  const npc: NpcWrite = {
    name: "New NPC",
    relationship: "neutral",
    level: 5,
    visibility: "hidden",
    baseDice: { DEX: 8, INS: 8, MIG: 8, WLP: 8 },
    hp: { current: 50, max: 50 },
    mp: { current: 45, max: 45 },
    defense: 8,
    magicDefense: 8,
    notes: "",
    attacks: [],
  };
  try {
    const result = await api.create(props.gameId, crypto.randomUUID(), npc);
    openEditor(result.npc.id);
    await refresh();
  } catch {
    toast.add({ title: "Could not create NPC.", color: "error" });
  } finally {
    creating.value = false;
  }
}
async function save(npc: Npc) {
  requestVersion++;
  const update = JSON.parse(JSON.stringify(toWrite(npc))) as NpcWrite;
  queued.set(npc.id, update);
  records.value = records.value.map((record) =>
    record.id === npc.id && record.view === "gm" ? { ...record, ...update } : record,
  );
  if (writing.value) return;
  writing.value = true;
  while (queued.size) {
    const [id, next] = queued.entries().next().value!;
    queued.delete(id);
    const current = records.value.find(
      (record): record is GmNpc => record.id === id && record.view === "gm",
    );
    if (!current) continue;
    try {
      const result = await api.update(props.gameId, id, current.revision, next);
      const pending = queued.get(id);
      records.value = records.value.map((record) =>
        record.id === id ? { ...result.npc, ...pending } : record,
      );
    } catch {
      queued.clear();
      toast.add({
        title: "NPC changes could not be saved. The latest version was restored.",
        color: "error",
      });
      await refresh();
      resetToken.value++;
    }
  }
  writing.value = false;
  if (refreshPending) {
    refreshPending = false;
    await refresh();
  }
}
async function remove(id: string) {
  const npc = records.value.find(
    (record): record is GmNpc => record.id === id && record.view === "gm",
  );
  if (!npc || writing.value || removing.value) return;
  removing.value = true;
  try {
    await api.remove(props.gameId, id, npc.revision);
    await closeEditor();
    await refresh();
  } catch {
    toast.add({ title: "Could not remove NPC. Refresh and try again.", color: "error" });
    await refresh();
  } finally {
    removing.value = false;
  }
}
async function closeEditor() {
  const id = selected.value;
  panelOpen.value = false;
  selected.value = "";
  await nextTick();
  document
    .querySelector<HTMLElement>(`[data-testid="npc-card-${id}"] [data-testid="edit-npc"]`)
    ?.focus();
}
function focus() {
  if (writing.value) refreshPending = true;
  else void refresh();
}
watch(
  () => props.hint,
  () => {
    focus();
  },
);
onMounted(() => {
  void refresh();
  window.addEventListener("focus", focus);
});
onUnmounted(() => {
  requestVersion++;
  window.removeEventListener("focus", focus);
});
</script>

<template>
  <li
    v-if="loading && !records.length"
    class="absolute right-0 top-0 rounded-panel bg-elevated px-small text-label text-muted"
    role="status"
    data-testid="npc-loading"
  >
    <ContentState kind="loading">Loading NPCs…</ContentState>
  </li>
  <NpcCard
    v-for="record in records"
    :key="record.id"
    :npc="prototypeNpc(record)"
    :redacted="record.view === 'visible'"
    :can-edit="record.view === 'gm'"
    :can-roll="record.view === 'gm'"
    :show-notes="record.view === 'gm'"
    @edit="openEditor(record.id)"
    @roll-attribute="
      (_, attribute) => record.view === 'gm' && emit('rollAttribute', record, attribute)
    "
    @roll-attack="(_, attack) => record.view === 'gm' && emit('rollAttack', record, attack)"
  />
  <UButton
    v-if="role === 'GM' && !panelOpen && !panelsBlocked && !externalTabs"
    class="npc-bookmark"
    color="info"
    data-testid="edge-tab-npcs"
    @click="openEditor()"
    >NPCs</UButton
  >
  <USlideover
    :open="panelOpen"
    title="NPCs"
    :ui="{ content: 'w-full sm:max-w-4xl' }"
    @update:open="setPanelOpen"
  >
    <template #body>
      <div class="space-y-small">
        <div class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            data-testid="create-npc"
            :loading="creating"
            :disabled="creating"
            @click="create"
            >+ New NPC</UButton
          >
        </div>
        <p
          v-if="writing"
          role="status"
          class="sticky top-0 z-10 rounded-panel bg-elevated p-small text-label"
          data-testid="npc-saving"
        >
          Saving changes…
        </p>
        <ContentState v-if="!loading && !records.length" kind="empty"
          >No NPCs yet. Create an NPC to get started.</ContentState
        >
        <CharacterSheetTabs
          v-model:selected-id="selected"
          :tabs="records.map((record) => ({ label: record.name, value: record.id }))"
        >
          <template #sheet>
            <NpcSheet
              v-if="selectedNpc"
              :key="selected"
              :npc="selectedNpc"
              :reset-token="resetToken"
              :pending="writing || removing"
              @save="save"
              @remove="remove"
            />
          </template>
        </CharacterSheetTabs>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.npc-bookmark {
  position: fixed;
  right: 0;
  top: calc(30% + 150px);
  z-index: 20;
  writing-mode: vertical-rl;
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
  padding: var(--spacing-medium) var(--spacing-small);
}
</style>
