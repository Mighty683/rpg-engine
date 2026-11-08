<script setup lang="ts">
import type { Attribute, PartyCharacter, ThrowRecord, ThrowSetup, RollDraft, FreeDraft, OpponentDraft } from "./types";

import { computed, ref, watch } from "vue";
import { useToast } from "@nuxt/ui/composables";
import { account } from "../auth/session";
import { useGameCharactersQuery } from "../characters/hooks";
import { useGameMembersQuery } from "../games/hooks";
import CharacterView from "../characters/CharacterView.vue";

import { useCreateThrowMutation, useGamePartyQuery, useRemoveThrowMutation, useThrowHistory } from "./hooks";
import PartyPanel from "./PartyPanel.vue";
import HistoryPanel from "./HistoryPanel.vue";
import RollDialog from "./RollDialog.vue";
import FreeRollDialog from "./FreeRollDialog.vue";

const props = defineProps<{ gameId: string; role: "GM" | "Player"; throwsHint: number }>();
const toast = useToast();

const partyQuery = useGamePartyQuery(props.gameId);
const roster = useGameCharactersQuery(props.gameId);
const membersQuery = useGameMembersQuery(props.gameId);
const history = useThrowHistory(props.gameId);
const createThrow = useCreateThrowMutation(props.gameId);
const removeThrow = useRemoveThrowMutation(props.gameId);

const party = computed(() => partyQuery.data.value?.characters ?? []);
const rosterById = computed(() => new Map((roster.data.value?.characters ?? []).map((entry) => [entry.id, entry])));

const sheetOpen = ref(false);
const selectedSheetId = ref("");
const sheetTabs = computed(() => party.value.map((member) => ({ label: member.name, value: member.id })));
watch(sheetTabs, (tabs) => {
  if (!tabs.some((tab) => tab.value === selectedSheetId.value)) selectedSheetId.value = tabs[0]?.value ?? "";
}, { immediate: true });
function openSheet(characterId: string) {
  selectedSheetId.value = characterId;
  sheetOpen.value = true;
}

const weaponHint = ref<{ character: PartyCharacter; weaponName: string } | null>(null);

const rollDraft = ref<RollDraft | null>(null);
const rollOpponent = ref<OpponentDraft>({ dice: [], modifier: "0" });
const rollError = ref("");
const rollSourceId = ref<string | null>(null);

const freeDraft = ref<FreeDraft | null>(null);
const freeOpponent = ref<OpponentDraft>({ dice: [], modifier: "0" });
const freeError = ref("");
const freeSourceId = ref<string | null>(null);

const highlightId = ref("");
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

watch(() => props.throwsHint, () => history.refresh());
watch(history.throws, (entries) => {
  if (!pendingHighlight.value) return;
  if (entries.some((entry) => entry.id === pendingHighlight.value)) {
    highlightId.value = pendingHighlight.value;
    pendingHighlight.value = null;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => { highlightId.value = ""; }, 1000);
  }
});
const pendingHighlight = ref<string | null>(null);

const currentMember = computed(() =>
  (membersQuery.data.value?.members ?? []).find((member) => member.accountId === account.value?.id && !member.removed),
);
const playerActiveCharacter = computed(() => {
  const activeId = currentMember.value?.activeCharacterId;
  return party.value.find((member) => member.id === activeId) ?? null;
});

const rollAsOptions = computed(() => [
  { label: "GM", value: "gm" },
  ...party.value.map((member) => ({ label: member.name, value: member.id })),
]);

function openAttributeRoll(character: PartyCharacter, attribute: Attribute) {
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
  rollError.value = "";
  freeError.value = "";
  const character = party.value.find((member) => member.id === entry.setup.characterId) ?? null;
  if (entry.setup.type === "weapon" && entry.equipmentId) {
    if (!character) {
      toast.add({ title: "The original character is no longer active, so this weapon roll cannot be rerolled. Make a free roll instead.", color: "error" });
      return;
    }
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
      dice: { ...character.baseDice, ...Object.fromEntries(entry.setup.dice.map((die) => [die.label, die.size])) } as Record<Attribute, number>,
      modifier: String(entry.setup.modifier),
      note: entry.setup.note,
    };
    return;
  }
  if (entry.setup.type === "attribute") {
    if (!character) {
      toast.add({ title: "The original character is no longer active, so this roll cannot be rerolled. Make a free roll instead.", color: "error" });
      return;
    }
    rollSourceId.value = entry.id;
    rollOpponent.value = { dice: entry.setup.redDice.map((die) => die.size), modifier: String(entry.setup.redModifier) };
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
      dice: { ...character.baseDice, ...Object.fromEntries(entry.setup.dice.map((die) => [die.label, die.size])) } as Record<Attribute, number>,
      modifier: String(entry.setup.modifier),
      note: entry.setup.note,
    };
    return;
  }
  freeSourceId.value = entry.id;
  freeOpponent.value = { dice: entry.setup.redDice.map((die) => die.size), modifier: String(entry.setup.redModifier) };
  const attributed = props.role === "GM" ? entry.characterId ?? "gm" : playerActiveCharacter.value?.id ?? "";
  freeDraft.value = {
    characterId: attributed,
    dice: entry.setup.dice.map((die) => die.size),
    modifier: String(entry.setup.modifier),
    note: entry.setup.note,
  };
}

function openFreeRoll() {
  weaponHint.value = null;
  freeSourceId.value = null;
  freeError.value = "";
  freeOpponent.value = { dice: [], modifier: "0" };
  freeDraft.value = {
    characterId: props.role === "GM" ? "gm" : playerActiveCharacter.value?.id ?? "",
    dice: [],
    modifier: "0",
    note: "",
  };
}

const wholeNumber = (value: string | number) => { const text = String(value).trim(); return text !== "" && Number.isSafeInteger(Number(text)) ? Number(text) : null; };

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
    dice: { [draft.first]: draft.dice[draft.first], ...(draft.second ? { [draft.second]: draft.dice[draft.second] } : {}) },
    modifier,
    redDice,
    redModifier,
    note: draft.note,
  };
}

async function submitRoll() {
  const draft = rollDraft.value;
  if (!draft) return;
  const setup = rollSetup(draft);
  if (!setup) return;
  rollError.value = "";
  try {
    const result = await createThrow.mutateAsync({ sourceThrowId: rollSourceId.value, setup });
    pendingHighlight.value = result.throw.id;
    rollDraft.value = null;
  } catch (error) {
    const payload = (error as { payload?: { error?: { message?: string; code?: string } } }).payload?.error;
    const status = (error as { status?: number }).status;
    if (!status || status >= 500) {
      rollDraft.value = null;
      toast.add({ title: "Could not confirm the roll. Check history before rolling again.", color: "error" });
    } else if (payload?.code === "stale_revision" || payload?.code === "inactive_character") {
      rollDraft.value = null;
      void partyQuery.refetch();
      toast.add({ title: "The character changed. Open the roll again to use the latest sheet.", color: "error" });
    } else rollError.value = payload?.message ?? "The roll could not be submitted.";
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
  return { type: "free", characterId: draft.characterId, dice: [...draft.dice], modifier, redDice, redModifier, note: draft.note };
}

async function submitFreeRoll() {
  const draft = freeDraft.value;
  if (!draft) return;
  const setup = freeSetup(draft);
  if (!setup) return;
  freeError.value = "";
  try {
    const result = await createThrow.mutateAsync({ sourceThrowId: freeSourceId.value, setup });
    pendingHighlight.value = result.throw.id;
    freeDraft.value = null;
  } catch (error) {
    const payload = (error as { payload?: { error?: { message?: string; code?: string } } }).payload?.error;
    const status = (error as { status?: number }).status;
    if (!status || status >= 500) {
      freeDraft.value = null;
      toast.add({ title: "Could not confirm the roll. Check history before rolling again.", color: "error" });
    } else {
      freeError.value = payload?.message ?? "The roll could not be submitted.";
      if (payload?.code === "no_active_character" || payload?.code === "inactive_character") void partyQuery.refetch();
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
  <div class="grid gap-section lg:grid-cols-2" data-testid="game-table">
    <section aria-labelledby="party-heading" class="rounded-panel border border-default p-large">
      <h2 id="party-heading" class="text-section font-semibold">Active party</h2>
      <p v-if="partyQuery.isLoading.value" class="text-muted">Loading party…</p>
      <p v-else-if="partyQuery.isError.value" role="alert">
        <UButton variant="outline" color="neutral" data-testid="retry-party" @click="partyQuery.refetch">Retry</UButton>
      </p>
      <PartyPanel
        v-else
        :party="party"
        @roll-attribute="openAttributeRoll"
        @roll-weapon="openWeaponRoll"
        @needs-weapon-setup="needsWeaponSetup"
      />
      <p v-if="weaponHint" role="alert" class="text-error pt-medium" data-testid="weapon-setup-hint">
        Set both attributes and the accuracy bonus for {{ weaponHint.weaponName }} on the character sheet.
        <UButton variant="link" data-testid="open-sheet-for-weapon" @click="openSheet(weaponHint.character.id)">Open character sheet</UButton>
      </p>
    </section>
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
    <RollDialog
      v-if="rollDraft"
      :draft="rollDraft"
      :opponent="rollOpponent"
      :error="rollError"
      :pending="createThrow.isPending.value"
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
      @update:opponent="freeOpponent = $event"
      @update:character="freeDraft.characterId = $event"
      @submit="submitFreeRoll"
      @cancel="freeDraft = null"
    />
    <USlideover v-model:open="sheetOpen" title="Character sheets" :ui="{ content: 'w-full sm:max-w-4xl' }">
      <UButton v-show="!sheetOpen" class="sheet-bookmark" color="primary" data-testid="open-character-sheets" @click="sheetOpen = true">Character sheets</UButton>
      <template #body>
        <UButton class="sheet-bookmark sheet-bookmark-close" color="primary" data-testid="close-character-sheets" aria-label="Close character sheets" @click="sheetOpen = false">Character sheets</UButton>
        <UTabs v-model="selectedSheetId" :items="sheetTabs" :ui="{ list: 'max-w-full overflow-x-auto', trigger: 'flex-none', content: 'min-w-0' }">
          <template #default="{ item }"><span data-testid="sheet-tab">{{ item.label }}</span></template>
          <template #content="{ item }">
            <CharacterView
              :key="item.value"
              :game-id="gameId"
              :character-id="item.value"
              :read-only="role !== 'GM' && !rosterById.get(item.value)?.canEdit"
            />
          </template>
        </UTabs>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.sheet-bookmark {
  position: fixed;
  right: 0;
  top: 45%;
  z-index: 20;
  writing-mode: vertical-rl;
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
  padding: var(--spacing-medium) var(--spacing-small);
}
.sheet-bookmark-close { z-index: 60; }
</style>
