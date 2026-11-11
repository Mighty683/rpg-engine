/** NPC-only operations. Character sheets, rolls and history use production controllers. */
import { reactive, watch, type Ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { partyKey } from "../../src/modules/game-table/hooks";
import type { Npc } from "./types";
import type { Tag } from "./tags";
import type { NpcApi, TableRole, TableScenario } from "./types";

export function useNpcTable(
  npcs: NpcApi,
  gameId: string,
  role: Ref<TableRole>,
  scenario: Ref<TableScenario>,
) {
  const client = useQueryClient();
  const state = reactive({
    role: role.value,
    view: scenario.value,
    npcs: [] as Npc[],
    savedTags: [] as Tag[],
    selectedSheetId: "",
    selectedNpcId: "__new__",
    edgeTab: null as string | null,
    settingsOpen: false,
    loading: false,
    loadError: false,
    pending: false,
    error: "",
  });
  async function perform(action: () => Promise<void>) {
    if (state.pending) return;
    state.pending = true;
    state.error = "";
    try {
      await action();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "The request failed. Try again.";
    } finally {
      state.pending = false;
    }
  }
  async function reload() {
    if (state.view === "Error") state.view = "Mixed";
    state.loading = true;
    state.loadError = false;
    try {
      const result = await npcs.list();
      state.npcs = result.npcs;
      state.savedTags = result.tags;
      if (state.role !== "GM" && state.selectedNpcId === "__new__")
        state.selectedNpcId = state.npcs[0]?.id ?? "__new__";
    } catch {
      state.loadError = true;
    } finally {
      state.loading = false;
    }
  }
  function mergeTags(tags: Tag[]) {
    state.savedTags = [
      ...new Map([...state.savedTags, ...tags].map((tag) => [tag.name, tag])).values(),
    ];
  }
  async function saveNpc(npc: Npc, tags: Tag[]) {
    if (state.role !== "GM") return;
    await perform(async () => {
      const result = await npcs.save(npc, tags);
      const index = state.npcs.findIndex((entry) => entry.id === result.npc.id);
      if (index < 0) state.npcs.push(result.npc);
      else state.npcs[index] = result.npc;
      mergeTags([...result.npc.tags, ...tags]);
      state.selectedNpcId = result.npc.id;
    });
  }
  async function saveCharacterTags(id: string, tags: Tag[]) {
    if (state.role !== "GM") return;
    await perform(async () => {
      await npcs.saveCharacterTags(id, tags);
      mergeTags(tags);
      await client.invalidateQueries({ queryKey: partyKey(gameId) });
    });
  }
  function openSheet(id: string) {
    state.selectedSheetId = id;
    state.edgeTab = "sheets";
  }
  watch(
    role,
    (value) => {
      state.role = value;
      if (value !== "GM" && state.selectedNpcId === "__new__")
        state.selectedNpcId = state.npcs[0]?.id ?? "__new__";
    },
    { immediate: true },
  );
  watch(scenario, (value) => {
    state.view = value;
  });
  void reload();
  return { state, reload, saveNpc, saveCharacterTags, openSheet };
}
