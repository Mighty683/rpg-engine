<script setup lang="ts">
import type {
  Attribute,
  PartyCharacter,
  ThrowRecord,
  ThrowSetup,
  RollDraft,
  FreeDraft,
  OpponentDraft,
} from "./types";

import { computed, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { account } from "../auth/session";
import { useGameCharactersQuery } from "../characters/hooks";
import { useGameMembersQuery } from "../games/hooks";
import CharacterView from "../characters/CharacterView.vue";
import NpcManager from "../npcs/NpcManager.vue";
import type { GmNpc } from "../npcs/api";
import type { NpcAttack } from "../npcs/types";

import {
  useCreateThrowMutation,
  useGamePartyQuery,
  useRemoveThrowMutation,
  useThrowHistory,
} from "./hooks";
import CharacterSheetsDrawer from "./CharacterSheetsDrawer.vue";
import PartyPanel from "./PartyPanel.vue";
import HistoryPanel from "./HistoryPanel.vue";
import EdgeTabs from "../../shared/design-system/base/EdgeTabs.vue";
import RollDialog from "./RollDialog.vue";
import FreeRollDialog from "./FreeRollDialog.vue";

const props = defineProps<{
  gameId: string;
  role: "GM" | "Player";
  throwsHint: number;
  npcsHint?: number;
}>();
const toast = useToast();

const partyQuery = useGamePartyQuery(props.gameId);
const roster = useGameCharactersQuery(props.gameId);
const membersQuery = useGameMembersQuery(props.gameId);
const history = useThrowHistory(props.gameId);
const createThrow = useCreateThrowMutation(props.gameId);
const removeThrow = useRemoveThrowMutation(props.gameId);

const party = computed(() => partyQuery.data.value?.characters ?? []);
const rosterById = computed(
  () => new Map((roster.data.value?.characters ?? []).map((entry) => [entry.id, entry])),
);

const sheetOpen = ref(false);
const npcEditorOpen = ref(false);
const historyTab = ref<string | null>(null);
const npcOpenRequest = ref(0);
const npcCloseRequest = ref(0);
const edgeTabs = computed(() => [
  {
    id: "sheets",
    label: "Character sheets",
    color: "primary" as const,
    testId: "open-character-sheets",
  },
  ...(props.role === "GM"
    ? [{ id: "npcs", label: "NPCs", color: "info" as const, testId: "edge-tab-npcs" }]
    : []),
  { id: "history", label: "Throw history", color: "warning" as const, testId: "edge-tab-history" },
]);
watch(sheetOpen, (open) => {
  if (open) historyTab.value = "sheets";
  else if (historyTab.value === "sheets") historyTab.value = null;
});
watch(npcEditorOpen, (open) => {
  if (open) historyTab.value = "npcs";
  else if (historyTab.value === "npcs") historyTab.value = null;
});
function selectEdgeTab(id: string | null) {
  sheetOpen.value = id === "sheets";
  if (id === "npcs") npcOpenRequest.value++;
  else if (npcEditorOpen.value) npcCloseRequest.value++;
}
const selectedSheetId = ref("");
const sheetTabs = computed(() =>
  party.value.map((member) => ({ label: member.name, value: member.id })),
);
watch(
  sheetTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.value === selectedSheetId.value))
      selectedSheetId.value = tabs[0]?.value ?? "";
  },
  { immediate: true },
);
function openSheet(characterId: string) {
  selectedSheetId.value = characterId;
  sheetOpen.value = true;
}

const weaponHint = ref<{ character: PartyCharacter; weaponName: string } | null>(null);

const privateRoll = ref(false);
const rollDraft = ref<RollDraft | null>(null);
const rollOpponent = ref<OpponentDraft>({ dice: [], modifier: "0" });
const rollError = ref("");
const rollSourceId = ref<string | null>(null);
const npcRoll = ref<GmNpc | null>(null);
const npcRecords = ref<GmNpc[]>([]);
function npcCharacter(npc: GmNpc): PartyCharacter {
  return {
    id: npc.id,
    revision: npc.revision,
    name: npc.name,
    level: npc.level,
    classes: [],
    baseDice: npc.baseDice,
    resources: { hp: npc.hp.current, mp: npc.mp.current, ip: 0, fabula: 0 },
    maxima: { hp: npc.hp.max, mp: npc.mp.max, ip: 0 },
    defense: npc.defense,
    magicDefense: npc.magicDefense,
    canRoll: true,
    weapons: npc.attacks.map((attack) => ({
      id: attack.id,
      name: attack.name,
      equipped: true,
      accuracyDice: attack.attributes,
      accuracyBonus: Math.floor(npc.level / 10),
      ready: true,
    })),
  };
}
function openNpcAttribute(npc: GmNpc, attribute: Attribute) {
  openAttributeRoll(npcCharacter(npc), attribute);
  npcRoll.value = npc;
}
function openNpcAttack(npc: GmNpc, attack: NpcAttack) {
  openWeaponRoll(npcCharacter(npc), attack.id);
  npcRoll.value = npc;
}

const freeDraft = ref<FreeDraft | null>(null);
const freeOpponent = ref<OpponentDraft>({ dice: [], modifier: "0" });
const freeError = ref("");
const freeSourceId = ref<string | null>(null);

const highlightId = ref("");
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.throwsHint,
  () => history.refresh(),
);
watch(history.throws, (entries) => {
  if (!pendingHighlight.value) return;
  if (entries.some((entry) => entry.id === pendingHighlight.value)) {
    highlightId.value = pendingHighlight.value;
    pendingHighlight.value = null;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      highlightId.value = "";
    }, 1000);
  }
});
const pendingHighlight = ref<string | null>(null);

const currentMember = computed(() =>
  (membersQuery.data.value?.members ?? []).find(
    (member) => member.accountId === account.value?.id && !member.removed,
  ),
);
const playerActiveCharacter = computed(() => {
  const activeId = currentMember.value?.activeCharacterId;
  return party.value.find((member) => member.id === activeId) ?? null;
});

const rollAsOptions = computed(() => [
  { label: "GM", value: "gm" },
  ...party.value.map((member) => ({ label: member.name, value: member.id })),
  ...npcRecords.value.map((npc) => ({ label: npc.name, value: npc.id })),
]);

function openAttributeRoll(character: PartyCharacter, attribute: Attribute) {
  privateRoll.value = false;
  npcRoll.value = null;
  weaponHint.value = null;
  rollSourceId.value = null;
  rollError.value = "";
  rollOpponent.value = { dice: [], modifier: "0" };
  rollDraft.value = {
    mode: "attribute",
    character,
    weaponId: null,
    weaponName: "",
    weaponBonus: 0,
    first: attribute,
    second: null,
    dice: { ...character.baseDice } as Record<Attribute, number>,
    modifier: "0",
    note: "",
  };
}

function openWeaponRoll(character: PartyCharacter, weaponId: string) {
  privateRoll.value = false;
  npcRoll.value = null;
  const weapon = character.weapons.find((entry) => entry.id === weaponId);
  if (!weapon || !weapon.ready) return;
  weaponHint.value = null;
  rollSourceId.value = null;
  rollError.value = "";
  rollOpponent.value = { dice: [], modifier: "0" };
  rollDraft.value = {
    mode: "weapon",
    character,
    weaponId,
    weaponName: weapon.name,
    weaponBonus: weapon.accuracyBonus ?? 0,
    first: weapon.accuracyDice[0]!,
    second: weapon.accuracyDice[1],
    dice: { ...character.baseDice } as Record<Attribute, number>,
    modifier: "0",
    note: "",
  };
}

function needsWeaponSetup(character: PartyCharacter, weaponId: string) {
  const weapon = character.weapons.find((entry) => entry.id === weaponId);
  weaponHint.value = { character, weaponName: weapon?.name ?? "this weapon" };
}

function openReroll(entry: ThrowRecord) {
  privateRoll.value = entry.private;
  rollError.value = "";
  freeError.value = "";
  if (entry.setup.type === "npc-attribute" || entry.setup.type === "npc-attack") {
    const setup = entry.setup;
    const npc = npcRecords.value.find((item) => item.id === setup.npcId);
    if (!npc || props.role !== "GM") {
      toast.add({ title: "This NPC roll cannot be rerolled.", color: "error" });
      return;
    }
    if (setup.type === "npc-attack") {
      const attack = npc.attacks.find((item) => item.id === setup.attack?.id);
      if (!attack) {
        toast.add({ title: "The original NPC attack is no longer available.", color: "error" });
        return;
      }
      openNpcAttack(npc, { ...attack, range: attack.reach });
      if (rollDraft.value) {
        rollDraft.value.first = setup.attributes[0];
        rollDraft.value.second = setup.attributes[1] ?? null;
        rollDraft.value.weaponBonus = setup.attack?.accuracyBonus ?? 0;
      }
    } else openNpcAttribute(npc, setup.attributes[0]);
    if (rollDraft.value) {
      rollDraft.value.second = setup.attributes[1] ?? null;
      for (const die of setup.dice)
        if (die.label && die.label in rollDraft.value.dice)
          rollDraft.value.dice[die.label as Attribute] = die.size;
      rollDraft.value.modifier = String(setup.modifier);
      rollDraft.value.note = setup.note;
    }
    privateRoll.value = entry.private;
    rollSourceId.value = entry.id;
    rollOpponent.value = {
      dice: setup.redDice.map((die) => die.size),
      modifier: String(setup.redModifier),
    };
    return;
  }
  const character = party.value.find((member) => member.id === entry.setup.characterId) ?? null;
  if (entry.setup.type === "weapon" && entry.equipmentId) {
    if (!character) {
      toast.add({
        title:
          "The original character is no longer active, so this weapon roll cannot be rerolled. Make a free roll instead.",
        color: "error",
      });
      return;
    }
    privateRoll.value = entry.private;
    rollSourceId.value = entry.id;
    rollOpponent.value = { dice: [], modifier: "0" };
    rollDraft.value = {
      mode: "weapon",
      character,
      weaponId: entry.equipmentId,
      weaponName: entry.equipmentName ?? "Weapon",
      weaponBonus: entry.setup.weaponBonus ?? 0,
      first: entry.setup.accuracyDice?.[0] ?? "DEX",
      second: entry.setup.accuracyDice?.[1] ?? null,
      dice: {
        ...character.baseDice,
        ...Object.fromEntries(entry.setup.dice.map((die) => [die.label, die.size])),
      } as Record<Attribute, number>,
      modifier: String(entry.setup.modifier),
      note: entry.setup.note,
    };
    return;
  }
  if (entry.setup.type === "attribute") {
    if (!character) {
      toast.add({
        title:
          "The original character is no longer active, so this roll cannot be rerolled. Make a free roll instead.",
        color: "error",
      });
      return;
    }
    privateRoll.value = entry.private;
    rollSourceId.value = entry.id;
    rollOpponent.value = {
      dice: entry.setup.redDice.map((die) => die.size),
      modifier: String(entry.setup.redModifier),
    };
    const first = entry.setup.dice[0]?.label as Attribute | undefined;
    const second = entry.setup.dice[1]?.label as Attribute | undefined;
    if (!first) return;
    rollDraft.value = {
      mode: "attribute",
      character,
      weaponId: null,
      weaponName: "",
      weaponBonus: 0,
      first,
      second: second ?? null,
      dice: {
        ...character.baseDice,
        ...Object.fromEntries(entry.setup.dice.map((die) => [die.label, die.size])),
      } as Record<Attribute, number>,
      modifier: String(entry.setup.modifier),
      note: entry.setup.note,
    };
    return;
  }
  freeSourceId.value = entry.id;
  freeOpponent.value = {
    dice: entry.setup.redDice.map((die) => die.size),
    modifier: String(entry.setup.redModifier),
  };
  const attributed =
    props.role === "GM"
      ? (entry.setup.npcId ?? entry.characterId ?? "gm")
      : (playerActiveCharacter.value?.id ?? "");
  freeDraft.value = {
    characterId: attributed,
    dice: entry.setup.dice.map((die) => die.size),
    modifier: String(entry.setup.modifier),
    note: entry.setup.note,
  };
}

function openFreeRoll() {
  privateRoll.value = false;
  weaponHint.value = null;
  freeSourceId.value = null;
  freeError.value = "";
  freeOpponent.value = { dice: [], modifier: "0" };
  freeDraft.value = {
    characterId: props.role === "GM" ? "gm" : (playerActiveCharacter.value?.id ?? ""),
    dice: [],
    modifier: "0",
    note: "",
  };
}

function openCustomFreeRoll(draft: FreeDraft) {
  if (props.role !== "GM") return;
  openFreeRoll();
  freeDraft.value = draft;
}

const wholeNumber = (value: string | number) => {
  const text = String(value).trim();
  return text !== "" && Number.isSafeInteger(Number(text)) ? Number(text) : null;
};

function rollSetup(draft: RollDraft): ThrowSetup | null {
  const modifier = wholeNumber(draft.modifier);
  const redModifier = wholeNumber(rollOpponent.value.modifier);
  if (modifier === null || redModifier === null) {
    rollError.value = "Enter a whole number for the modifier.";
    return null;
  }
  if (draft.mode === "weapon" && draft.weaponId) {
    return {
      type: "weapon",
      characterId: draft.character.id,
      equipmentId: draft.weaponId,
      expectedRevision: draft.character.revision,
      dice: [draft.dice[draft.first], draft.dice[draft.second ?? draft.first]],
      modifier,
      note: draft.note,
    };
  }
  const redDice = rollOpponent.value.dice;
  return {
    type: "attribute",
    characterId: draft.character.id,
    expectedRevision: draft.character.revision,
    attributes: draft.second ? [draft.first, draft.second] : [draft.first],
    dice: {
      [draft.first]: draft.dice[draft.first],
      ...(draft.second ? { [draft.second]: draft.dice[draft.second] } : {}),
    },
    modifier,
    redDice,
    redModifier,
    note: draft.note,
  };
}

async function submitRoll() {
  const draft = rollDraft.value;
  if (!draft) return;
  let setup = rollSetup(draft);
  if (!setup) return;
  if (npcRoll.value && setup.type === "attribute") {
    const { characterId, ...rest } = setup;
    setup = { ...rest, type: "npc-attribute", npcId: characterId };
  } else if (npcRoll.value && setup.type === "weapon") {
    const { characterId, equipmentId, ...rest } = setup;
    setup = { ...rest, type: "npc-attack", npcId: characterId, attackId: equipmentId };
  }
  rollError.value = "";
  try {
    const result = await createThrow.mutateAsync({
      sourceThrowId: rollSourceId.value,
      private: privateRoll.value,
      setup,
    });
    pendingHighlight.value = result.throw.id;
    rollDraft.value = null;
    historyTab.value = "history";
  } catch (error) {
    const payload = (error as { payload?: { error?: { message?: string; code?: string } } }).payload
      ?.error;
    const status = (error as { status?: number }).status;
    if (!status || status >= 500) {
      rollDraft.value = null;
      toast.add({
        title: "Could not confirm the roll. Check history before rolling again.",
        color: "error",
      });
    } else if (payload?.code === "stale_revision" || payload?.code === "inactive_character") {
      rollDraft.value = null;
      void partyQuery.refetch();
      toast.add({
        title: "The character changed. Open the roll again to use the latest sheet.",
        color: "error",
      });
    } else
      toast.add({
        title: payload?.message ?? "The roll could not be submitted. Try again.",
        color: "error",
      });
  }
}

function freeSetup(draft: FreeDraft): ThrowSetup | null {
  const modifier = wholeNumber(draft.modifier);
  const redModifier = wholeNumber(freeOpponent.value.modifier);
  if (draft.dice.length < 1 || draft.dice.length > 2) {
    freeError.value = "Choose one or two friendly dice.";
    return null;
  }
  if (modifier === null || redModifier === null) {
    freeError.value = "Enter a whole number for the modifier.";
    return null;
  }
  const redDice = freeOpponent.value.dice;
  return {
    type: "free",
    characterId: draft.characterId,
    dice: [...draft.dice],
    modifier,
    redDice,
    redModifier,
    note: draft.note,
  };
}

async function submitFreeRoll() {
  const draft = freeDraft.value;
  if (!draft) return;
  const setup = freeSetup(draft);
  if (!setup) return;
  freeError.value = "";
  try {
    const result = await createThrow.mutateAsync({
      sourceThrowId: freeSourceId.value,
      private: privateRoll.value,
      setup,
    });
    pendingHighlight.value = result.throw.id;
    freeDraft.value = null;
    historyTab.value = "history";
  } catch (error) {
    const payload = (error as { payload?: { error?: { message?: string; code?: string } } }).payload
      ?.error;
    const status = (error as { status?: number }).status;
    if (!status || status >= 500) {
      freeDraft.value = null;
      toast.add({
        title: "Could not confirm the roll. Check history before rolling again.",
        color: "error",
      });
    } else {
      toast.add({
        title: payload?.message ?? "The roll could not be submitted. Try again.",
        color: "error",
      });
      if (payload?.code === "no_active_character" || payload?.code === "inactive_character")
        void partyQuery.refetch();
    }
  }
}

async function removeEntry(entry: ThrowRecord) {
  try {
    await removeThrow.mutateAsync(entry.id);
  } catch {
    toast.add({ title: "Could not remove the throw. Try again.", color: "error" });
  }
}
</script>

<template>
  <div data-testid="game-table">
    <slot
      name="layout"
      :party="party"
      :party-query="partyQuery"
      :history="history"
      :highlight-id="highlightId"
      :open-attribute-roll="openAttributeRoll"
      :open-weapon-roll="openWeaponRoll"
      :open-free-roll="openFreeRoll"
      :open-custom-free-roll="openCustomFreeRoll"
      :reroll="openReroll"
      :remove-entry="removeEntry"
    >
      <div class="space-y-section">
        <PartyPanel
          :party="party"
          :is-loading="partyQuery.isLoading.value"
          :is-error="partyQuery.isError.value"
          :weapon-hint="weaponHint"
          @retry="partyQuery.refetch"
          @roll-attribute="openAttributeRoll"
          @roll-weapon="openWeaponRoll"
          @needs-weapon-setup="needsWeaponSetup"
          @open-sheet="openSheet"
        >
          <NpcManager
            :game-id="gameId"
            :role="role"
            :hint="npcsHint ?? 0"
            :panels-blocked="sheetOpen"
            external-tabs
            :open-request="npcOpenRequest"
            :close-request="npcCloseRequest"
            @editor-open="npcEditorOpen = $event"
            @changed="npcRecords = $event"
            @roll-attribute="openNpcAttribute"
            @roll-attack="openNpcAttack"
          />
        </PartyPanel>
      </div>
      <EdgeTabs v-model:open-id="historyTab" :tabs="edgeTabs" tabs-only @open="selectEdgeTab" />
      <USlideover
        :open="historyTab === 'history'"
        title="Throw history"
        @update:open="
          (open: boolean) => {
            if (!open && historyTab === 'history') historyTab = null;
          }
        "
      >
        <template #body>
          <HistoryPanel
            :throws="history.throws.value"
            :is-loading="history.isLoading.value"
            :is-error="history.isError.value"
            :has-older="history.hasOlder.value"
            :highlight-id="highlightId"
            @reroll="openReroll"
            @remove="removeEntry"
            @load-older="history.loadOlder"
            @retry="history.refresh"
            @make-roll="openFreeRoll"
          />
        </template>
      </USlideover>
      <CharacterSheetsDrawer
        v-model:open="sheetOpen"
        v-model:selected-id="selectedSheetId"
        :show-bookmark="false"
        :tabs="sheetTabs"
      >
        <template #sheet="{ characterId }">
          <CharacterView
            :key="characterId"
            :game-id="gameId"
            :character-id="characterId"
            :read-only="role !== 'GM' && !rosterById.get(characterId)?.canEdit"
          />
        </template>
      </CharacterSheetsDrawer>
    </slot>
    <RollDialog
      v-if="rollDraft"
      :draft="rollDraft"
      :opponent="rollOpponent"
      :error="rollError"
      :pending="createThrow.isPending.value"
      :private-roll="privateRoll"
      @update:private-roll="privateRoll = $event"
      @update:opponent="rollOpponent = $event"
      @submit="submitRoll"
      @cancel="rollDraft = null"
    />
    <FreeRollDialog
      v-if="freeDraft"
      :draft="freeDraft"
      :opponent="freeOpponent"
      :role="role"
      :roll-as-options="rollAsOptions"
      :player-active-name="playerActiveCharacter?.name ?? ''"
      :player-has-active="Boolean(playerActiveCharacter)"
      :error="freeError"
      :pending="createThrow.isPending.value"
      :private-roll="privateRoll"
      @update:private-roll="privateRoll = $event"
      @update:opponent="freeOpponent = $event"
      @update:character="freeDraft.characterId = $event"
      @submit="submitFreeRoll"
      @cancel="freeDraft = null"
    />
  </div>
</template>
