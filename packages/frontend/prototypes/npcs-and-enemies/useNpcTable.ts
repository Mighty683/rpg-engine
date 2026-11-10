/** Table application controller. Server snapshots are authoritative; drafts are saved explicitly. */
import { computed, reactive, ref, watch, type Ref } from "vue";
import type { ApiServices } from "../../src/shared/api-services";
import { toCharacter, toSheet } from "../../src/modules/characters/sheet/model";
import type { Character, Sheet, Resource } from "../../src/modules/characters/sheet/types";
import type { Character as PersistedCharacter } from "../../src/modules/characters/types";
import type {
  Attribute,
  PartyCharacter,
  RollDraft,
  FreeDraft,
  OpponentDraft,
  ThrowRecord,
  ThrowSetup,
} from "../../src/modules/game-table/types";
import type { Npc } from "./fixtures";
import type { Tag } from "./tags";
import type { NpcApi, TableRole, TableScenario } from "./types";

export function useNpcTable(
  api: ApiServices,
  npcs: NpcApi,
  gameId: string,
  role: Ref<TableRole>,
  scenario: Ref<TableScenario>,
) {
  const state = reactive({
    role: role.value,
    view: scenario.value,
    party: [] as PartyCharacter[],
    npcs: [] as Npc[],
    savedTags: [] as Tag[],
    selectedSheetId: "",
    selectedNpcId: "__new__",
    edgeTab: null as string | null,
    character: null as Character | null,
    maximumOverrides: { HP: null, MP: null, IP: null } as Record<Resource, number | null>,
    rollDraft: null as RollDraft | null,
    rollOpponent: { dice: [], modifier: "0" } as OpponentDraft,
    freeDraft: null as FreeDraft | null,
    freeOpponent: { dice: [], modifier: "0" } as OpponentDraft,
    throws: [] as ThrowRecord[],
    settingsOpen: false,
    loading: false,
    sheetLoading: false,
    loadError: false,
    pending: false,
    error: "",
  });
  const snapshot = ref<PersistedCharacter | null>(null);
  let selectionVersion = 0;
  const sheet = computed(() => snapshot.value?.sheet as Sheet | undefined);
  const derived = computed(
    () =>
      snapshot.value?.derived as
        | {
            maxima?: { hp: number; mp: number; ip: number };
            defenses?: Record<string, { calculated: number }>;
          }
        | undefined,
  );
  const maximum = computed(() => ({
    HP: state.maximumOverrides.HP ?? derived.value?.maxima?.hp ?? 0,
    MP: state.maximumOverrides.MP ?? derived.value?.maxima?.mp ?? 0,
    IP: state.maximumOverrides.IP ?? derived.value?.maxima?.ip ?? 0,
  }));
  const baseDefense = computed(() => ({
    DEF: derived.value?.defenses?.defense?.calculated ?? null,
    "MAG DEF": derived.value?.defenses?.magicDefense?.calculated ?? null,
    INIT: derived.value?.defenses?.initiative?.calculated ?? null,
  }));
  function mergeTags(tags: readonly Tag[]) {
    state.savedTags = [
      ...new Map([...state.savedTags, ...tags].map((tag) => [tag.name, tag])).values(),
    ];
  }
  async function perform(action: () => Promise<void>) {
    if (state.pending) return;
    state.pending = true;
    state.error = "";
    try {
      await action();
    } catch (error) {
      state.error =
        error instanceof Error
          ? error.message
          : "The request failed. Your draft has been preserved.";
    } finally {
      state.pending = false;
    }
  }
  async function refreshParty() {
    state.party = (await api.gameTable.getGameParty(gameId)).characters;
  }
  function applySnapshot(value: PersistedCharacter) {
    snapshot.value = value;
    const current = value.sheet as Sheet;
    state.character = toCharacter(current, value.id ?? state.selectedSheetId, false);
    state.character.tags =
      state.party.find((member) => member.id === state.selectedSheetId)?.tags ?? [];
    state.maximumOverrides = {
      HP: current.overrides.maxHp,
      MP: current.overrides.maxMp,
      IP: current.overrides.maxIp,
    };
  }
  async function selectCharacter(id: string) {
    const version = ++selectionVersion;
    state.character = null;
    snapshot.value = null;
    if (!id) return;
    state.sheetLoading = true;
    try {
      const result = await api.characters.getGameCharacter(gameId, id);
      if (version === selectionVersion) applySnapshot(result.character);
    } catch (error) {
      if (version === selectionVersion)
        state.error = error instanceof Error ? error.message : "Could not load character";
    } finally {
      if (version === selectionVersion) state.sheetLoading = false;
    }
  }
  async function reload() {
    if (state.view === "Error") state.view = "Mixed";
    state.loading = true;
    state.loadError = false;
    state.error = "";
    try {
      const [party, npcResult, history] = await Promise.all([
        api.gameTable.getGameParty(gameId),
        npcs.list(),
        api.gameTable.listGameThrows(gameId, { limit: 100 }),
      ]);
      state.party = party.characters;
      state.npcs = npcResult.npcs;
      state.savedTags = npcResult.tags;
      state.throws = history.throws;
      if (!state.party.some((member) => member.id === state.selectedSheetId))
        state.selectedSheetId = state.party[0]?.id ?? "";
      if (state.selectedNpcId === "__new__" && state.role !== "GM")
        state.selectedNpcId = state.npcs[0]?.id ?? "__new__";
    } catch (error) {
      state.loadError = true;
      state.error = error instanceof Error ? error.message : "Could not load table";
    } finally {
      state.loading = false;
    }
  }
  function overrideMaximum(resource: Resource, value: number | null) {
    if (state.role === "GM") state.maximumOverrides[resource] = value;
  }
  function selectSheet(id: string): boolean {
    if (id === state.selectedSheetId) return true;
    const current = sheet.value;
    const draft = state.character;
    if (current && draft) {
      const next = toSheet(draft, current);
      next.overrides = {
        ...next.overrides,
        maxHp: state.maximumOverrides.HP,
        maxMp: state.maximumOverrides.MP,
        maxIp: state.maximumOverrides.IP,
      };
      const savedTags =
        state.party.find((member) => member.id === state.selectedSheetId)?.tags ?? [];
      const changed =
        JSON.stringify(next) !== JSON.stringify(current) ||
        JSON.stringify(draft.tags ?? []) !== JSON.stringify(savedTags);
      if (changed && !window.confirm("Discard unsaved character changes and switch sheets?"))
        return false;
    }
    state.selectedSheetId = id;
    return true;
  }
  function openSheet(id: string) {
    if (selectSheet(id)) state.edgeTab = "sheets";
  }
  async function saveCharacter() {
    if (state.role !== "GM" || !state.character || !snapshot.value || !sheet.value) return;
    const id = state.selectedSheetId;
    const revision = snapshot.value.revision;
    const changes = toSheet(state.character, sheet.value);
    changes.overrides = {
      ...changes.overrides,
      maxHp: state.maximumOverrides.HP,
      maxMp: state.maximumOverrides.MP,
      maxIp: state.maximumOverrides.IP,
    };
    const tags = state.character.tags?.map((tag) => ({ ...tag })) ?? [];
    await perform(async () => {
      const result = await api.characters.saveGameCharacter(gameId, id, revision, changes);
      // Keep the accepted revision even if the independent tag request fails.
      if (id === state.selectedSheetId) snapshot.value = result.character;
      try {
        await npcs.saveCharacterTags(id, tags);
      } finally {
        await refreshParty();
      }
      mergeTags(tags);
      if (id === state.selectedSheetId) applySnapshot(result.character);
    });
  }
  async function saveNpc(npc: Npc, tags: Tag[]) {
    if (state.role !== "GM") return;
    await perform(async () => {
      const result = await npcs.save(npc, tags);
      const index = state.npcs.findIndex((candidate) => candidate.id === result.npc.id);
      if (index < 0) state.npcs.push(result.npc);
      else state.npcs[index] = result.npc;
      mergeTags([...result.npc.tags, ...tags]);
      state.selectedNpcId = result.npc.id;
    });
  }
  function npcMember(npc: Npc): PartyCharacter {
    return {
      id: npc.id,
      revision: 1,
      name: npc.name,
      classes: [],
      baseDice: npc.baseDice,
      resources: { hp: npc.hp.current, mp: npc.mp.current, ip: 0, fabula: 0 },
      maxima: { hp: npc.hp.max, mp: npc.mp.max, ip: 0 },
      defense: npc.defense,
      magicDefense: npc.magicDefense,
      weapons: [],
      canRoll: state.role === "GM",
    };
  }
  function openAttributeRoll(member: PartyCharacter, attribute: Attribute) {
    if (state.role !== "GM" && !member.canRoll) return;
    state.error = "";
    state.rollOpponent = { dice: [], modifier: "0" };
    state.rollDraft = {
      mode: "attribute",
      character: member,
      weaponId: null,
      weaponName: "",
      weaponBonus: 0,
      first: attribute,
      second: null,
      dice: { ...member.baseDice },
      modifier: "0",
      note: "",
    };
  }
  function openNpcAttributeRoll(npc: Npc, attribute: Attribute) {
    if (state.role === "GM") openAttributeRoll(npcMember(npc), attribute);
  }
  function openWeaponRoll(member: PartyCharacter, id: string) {
    const weapon = member.weapons.find((candidate) => candidate.id === id);
    if (
      !weapon?.accuracyDice[0] ||
      !weapon.accuracyDice[1] ||
      (state.role !== "GM" && !member.canRoll)
    )
      return;
    openAttributeRoll(member, weapon.accuracyDice[0]);
    Object.assign(state.rollDraft!, {
      mode: "weapon",
      weaponId: id,
      weaponName: weapon.name,
      weaponBonus: weapon.accuracyBonus ?? 0,
      second: weapon.accuracyDice[1],
    });
  }
  function openAttackRoll(npc: Npc, attack: Npc["attacks"][number]) {
    if (state.role !== "GM") return;
    openNpcAttributeRoll(npc, attack.attributes[0] as Attribute);
    Object.assign(state.rollDraft!, {
      mode: "weapon",
      weaponId: attack.id,
      weaponName: attack.name,
      weaponBonus: Math.floor(npc.level / 10),
      second: attack.attributes[1],
      note: `high roll +${attack.damageBonus} ${attack.damageType}`,
    });
  }
  async function createThrow(setup: ThrowSetup, sourceThrowId: string | null = null) {
    await perform(async () => {
      await api.gameTable.createGameThrow(gameId, { setup, sourceThrowId });
      state.throws = (await api.gameTable.listGameThrows(gameId, { limit: 100 })).throws;
      state.rollDraft = null;
      state.freeDraft = null;
    });
  }
  async function submitRoll() {
    const draft = state.rollDraft;
    if (!draft) return;
    const isNpc = state.npcs.some((npc) => npc.id === draft.character.id);
    if (state.role !== "GM" && (isNpc || !draft.character.canRoll)) return;
    const attributes: [Attribute, Attribute?] = draft.second
      ? [draft.first, draft.second]
      : [draft.first];
    const modifier = Number(draft.modifier);
    if (isNpc) {
      await createThrow({
        type: "free",
        characterId: "gm",
        dice: attributes.map((attribute) => draft.dice[attribute!]),
        modifier: modifier + draft.weaponBonus,
        redDice: state.rollOpponent.dice,
        redModifier: Number(state.rollOpponent.modifier),
        note: `${draft.character.name}${draft.weaponName ? ` — ${draft.weaponName}` : ""}: ${draft.note}`,
      });
      return;
    }
    if (draft.mode === "weapon" && draft.weaponId && draft.second) {
      await createThrow({
        type: "weapon",
        characterId: draft.character.id,
        expectedRevision: draft.character.revision,
        equipmentId: draft.weaponId,
        dice: [draft.dice[draft.first], draft.dice[draft.second]],
        modifier,
        note: draft.note,
      });
      return;
    }
    await createThrow({
      type: "attribute",
      characterId: draft.character.id,
      expectedRevision: draft.character.revision,
      attributes,
      dice: draft.dice,
      modifier,
      redDice: state.rollOpponent.dice,
      redModifier: Number(state.rollOpponent.modifier),
      note: draft.note,
    });
  }
  function openFreeRoll() {
    state.error = "";
    state.freeOpponent = { dice: [], modifier: "0" };
    state.freeDraft = {
      characterId:
        state.role === "GM" ? "gm" : (state.party.find((member) => member.canRoll)?.id ?? ""),
      dice: [],
      modifier: "0",
      note: "",
    };
  }
  async function submitFreeRoll() {
    const draft = state.freeDraft;
    if (
      !draft ||
      (state.role !== "GM" &&
        !state.party.some((member) => member.id === draft.characterId && member.canRoll))
    )
      return;
    await createThrow({
      type: "free",
      characterId: draft.characterId,
      dice: [...draft.dice],
      modifier: Number(draft.modifier),
      redDice: [...state.freeOpponent.dice],
      redModifier: Number(state.freeOpponent.modifier),
      note: draft.note,
    });
  }
  async function removeThrow(entry: ThrowRecord) {
    if (!entry.canRemove) return;
    await perform(async () => {
      await api.gameTable.deleteGameThrow(gameId, entry.id);
      state.throws = (await api.gameTable.listGameThrows(gameId, { limit: 100 })).throws;
    });
  }
  async function reroll(entry: ThrowRecord) {
    const setup = entry.setup;
    const characterId = setup.characterId ?? "gm";
    if (
      state.role !== "GM" &&
      !state.party.some((member) => member.id === characterId && member.canRoll)
    )
      return;
    await createThrow(
      {
        type: "free",
        characterId,
        dice: setup.dice.map((die) => die.size),
        modifier: setup.modifier + (setup.weaponBonus ?? 0),
        redDice: setup.redDice.map((die) => die.size),
        redModifier: setup.redModifier,
        note: setup.note,
      },
      entry.id,
    );
  }
  watch(() => state.selectedSheetId, selectCharacter);
  watch(role, (value) => {
    state.role = value;
    state.rollDraft = null;
    state.freeDraft = null;
    if (value !== "GM" && state.selectedNpcId === "__new__")
      state.selectedNpcId = state.npcs[0]?.id ?? "__new__";
    void selectCharacter(state.selectedSheetId);
  });
  watch(scenario, (value) => {
    state.view = value;
  });
  void reload();
  return {
    state,
    maximum,
    baseDefense,
    reload,
    saveCharacter,
    selectSheet,
    openSheet,
    overrideMaximum,
    saveNpc,
    openAttributeRoll,
    openWeaponRoll,
    openNpcAttributeRoll,
    openAttackRoll,
    openFreeRoll,
    submitRoll,
    submitFreeRoll,
    removeThrow,
    reroll,
  };
}
