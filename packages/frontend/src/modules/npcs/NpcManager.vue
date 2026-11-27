<script setup lang="ts">
import { tr } from "../../shared/i18n";
import SkeletonRegion from "../../shared/design-system/base/SkeletonRegion.vue";
import SkeletonBlock from "../../shared/design-system/base/SkeletonBlock.vue";
import TableCardSkeleton from "../game-table/TableCardSkeleton.vue";
import CharacterSheetSkeleton from "../characters/sheet/CharacterSheetSkeleton.vue";
import { newUuid } from "../../shared/uuid";
import ContentState from "../../shared/design-system/base/ContentState.vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
  panelOpen: boolean;
  selected: string;
}>();
const emit = defineEmits<{
  rollAttribute: [npc: GmNpc, attribute: Attribute];
  rollAttack: [npc: GmNpc, attack: NpcAttack];
  changed: [npcs: GmNpc[]];
  open: [id: string, replace?: boolean];
  close: [];
}>();
const api = useApiServices().npcs;
const toast = useToast();
const records = ref<NpcRead[]>([]);
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
const active = computed(
  () => records.value.find((npc) => npc.id === props.selected) ?? records.value[0],
);
const selectedNpc = computed(() =>
  active.value && active.value.view !== "visible" ? prototypeNpc(active.value) : null,
);
function openEditor(id = "") {
  emit("open", id || records.value[0]?.id || "");
}
async function refresh() {
  const version = ++requestVersion;
  loading.value = true;
  try {
    const data = await api.list(props.gameId);
    if (!Array.isArray(data.npcs)) throw new Error(tr("ui.invalidNpcResponse"));
    if (version === requestVersion) records.value = data.npcs;
  } catch {
    if (version === requestVersion) {
      records.value = [];
      toast.add({ title: tr("ui.couldNotLoadNpcs"), color: "error" });
    }
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}
async function create() {
  if (props.role !== "GM" || creating.value) return;
  creating.value = true;
  const npc: NpcWrite = {
    name: tr("ui.newNpc"),
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
    const result = await api.create(props.gameId, newUuid(), npc);
    await refresh();
    if (props.panelOpen) openEditor(result.npc.id);
  } catch {
    toast.add({ title: tr("ui.couldNotCreateNpc"), color: "error" });
  } finally {
    creating.value = false;
  }
}
async function writeProfile(id: string, expectedRevision: number, next: NpcWrite) {
  const result = await api.update(props.gameId, id, expectedRevision, next);
  const pending = queued.get(id);
  records.value = records.value.map((record) =>
    record.id === id ? { ...result.npc, ...pending } : record,
  );
}

async function saveReviewed(id: string, expectedRevision: number, next: NpcWrite) {
  if (writing.value || removing.value || props.panelOpen)
    throw new Error(tr("ui.finishTheOpenNpcEditAndReviewTheChange"));
  requestVersion++;
  writing.value = true;
  try {
    await writeProfile(id, expectedRevision, next);
  } finally {
    await drainQueue();
  }
}
defineExpose({ saveReviewed });

async function save(npc: Npc) {
  requestVersion++;
  const update = JSON.parse(JSON.stringify(toWrite(npc))) as NpcWrite;
  queued.set(npc.id, update);
  records.value = records.value.map((record) =>
    record.id === npc.id && record.view === "gm" ? { ...record, ...update } : record,
  );
  if (writing.value) return;
  writing.value = true;
  await drainQueue();
}
async function drainQueue() {
  while (queued.size) {
    const [id, next] = queued.entries().next().value!;
    queued.delete(id);
    const current = records.value.find(
      (record): record is GmNpc => record.id === id && record.view === "gm",
    );
    if (!current) continue;
    try {
      await writeProfile(id, current.revision, next);
    } catch {
      queued.clear();
      toast.add({
        title: tr("ui.npcChangesCouldNotBeSavedTheLatestVersion"),
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
    if (props.panelOpen) closeEditor();
    await refresh();
  } catch {
    toast.add({ title: tr("ui.couldNotRemoveNpcRefreshAndTryAgain"), color: "error" });
    await refresh();
  } finally {
    removing.value = false;
  }
}
let focusNpcId = "";
function closeEditor() {
  focusNpcId = props.selected;
  emit("close");
}
function restoreFocus(event: Event) {
  const target = document.querySelector<HTMLElement>(
    `[data-testid="npc-card-${CSS.escape(focusNpcId)}"] :is([data-testid="edit-npc"], [data-testid="view-details"])`,
  );
  focusNpcId = "";
  if (target) {
    event.preventDefault();
    target.focus();
  }
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
  <li v-if="loading && !records.length" class="table-card" data-testid="npc-loading" role="status">
    <span class="sr-only">{{ tr("ui.loadingNpcs") }}</span>
    <TableCardSkeleton />
  </li>
  <NpcCard
    v-for="record in records"
    :key="record.id"
    :npc="prototypeNpc(record)"
    :redacted="record.view === 'visible'"
    can-view
    :can-edit="record.view === 'gm'"
    :can-roll="record.view === 'gm'"
    :show-notes="record.view === 'gm'"
    @edit="openEditor(record.id)"
    @roll-attribute="
      (_, attribute) => record.view === 'gm' && emit('rollAttribute', record, attribute)
    "
    @roll-attack="(_, attack) => record.view === 'gm' && emit('rollAttack', record, attack)"
  />
  <USlideover
    :open="panelOpen"
    :modal="false"
    :overlay="false"
    :content="{
      onCloseAutoFocus: restoreFocus,
      onInteractOutside: (event: Event) => event.preventDefault(),
    }"
    :title="tr('ui.npcs')"
    :ui="{ content: 'w-full sm:max-w-4xl' }"
    @update:open="
      (open: boolean) => {
        if (!open && panelOpen) closeEditor();
      }
    "
  >
    <template #body>
      <div class="space-y-small">
        <div v-if="role === 'GM'" class="flex justify-end">
          <UButton
            color="neutral"
            variant="outline"
            data-testid="create-npc"
            :loading="creating"
            :disabled="creating"
            @click="create"
            >{{ tr("ui.newNpc2") }}</UButton
          >
        </div>
        <p
          v-if="writing"
          role="status"
          class="sticky top-0 z-10 rounded-panel bg-elevated p-small text-label"
          data-testid="npc-saving"
        >
          {{ tr("ui.savingChanges") }}
        </p>
        <SkeletonRegion
          v-if="loading && !records.length"
          :label="tr('ui.loadingNpcs')"
          class="space-y-small"
        >
          <SkeletonBlock class="h-9 w-1/3" />
          <CharacterSheetSkeleton v-if="role === 'GM'" />
          <div v-else class="space-y-small rounded-panel border border-default p-medium">
            <SkeletonBlock class="h-6 w-1/3" />
            <SkeletonBlock class="w-1/4" />
            <SkeletonBlock class="w-2/3" />
          </div>
        </SkeletonRegion>
        <ContentState v-else-if="!records.length" kind="empty">{{
          role === "GM" ? tr("ui.noNpcsYetCreateAnNpcToGetStarted") : tr("ui.noNpcsAreVisibleToYou")
        }}</ContentState>
        <CharacterSheetTabs
          :selected-id="active?.id ?? ''"
          @update:selected-id="(id) => id && panelOpen && openEditor(id)"
          :tabs="records.map((record) => ({ label: record.name, value: record.id }))"
        >
          <template #sheet>
            <NpcSheet
              v-if="selectedNpc"
              :key="selectedNpc.id"
              :npc="selectedNpc"
              :read-only="role !== 'GM' || active?.view !== 'gm'"
              :reset-token="resetToken"
              :pending="writing || removing"
              @save="save"
              @remove="remove"
            />
            <section
              v-else-if="active?.view === 'visible'"
              class="space-y-small rounded-panel border border-default p-medium"
              data-testid="npc-public-details"
            >
              <h2 class="text-section font-semibold">{{ active.name }}</h2>
              <p class="capitalize">{{ tr(`ui.${active.relationship ?? "neutral"}`) }}</p>
              <p class="text-small text-muted">{{ tr("ui.statsAndAttacksAreUnknown") }}</p>
            </section>
          </template>
        </CharacterSheetTabs>
      </div>
    </template>
  </USlideover>
</template>
