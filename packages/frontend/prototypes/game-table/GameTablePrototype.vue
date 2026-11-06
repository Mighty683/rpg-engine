<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import CharacterSheet from "../../src/modules/characters/sheet/CharacterSheet.vue";
import { toCharacter } from "../../src/modules/characters/sheet/model";
import PartyOverview from "./PartyOverview.vue";
import { party, sheetFixtures } from "./mock-data";
import { attributes, dieSizes, type Attribute, type PartyMember } from "./model";
import type { NamedEntry } from "../../src/modules/characters/sheet/types";
import DieIcon from "../../src/shared/design-system/DieIcon.vue";
import OpposedSetup, { type OpponentDraft } from "./OpposedSetup.vue";
import { rollOpposed, type OpposedRoll, type OpposedSide } from "./opposed";

const props = withDefaults(defineProps<{ role?: "GM" | "Player" }>(), { role: "GM" });
const selectedSheetId = ref(party[0]!.id);
const sheetOpen = ref(false);
const showSettings = ref(false);
watch(() => props.role, () => { showSettings.value = false; });
const playerActive = ref(true);
const invitationCreated = ref(false);
const invitationEnabled = ref(true);
type ThrowResult = { id: string; character: string; actor?: string; weapon: string; weaponBonus?: number; dice: { attribute: string; size: number; face: number }[]; bonus: number; total: number; special: string; note?: string; opponent?: OpposedRoll; opposedSides?: [OpposedSide, OpposedSide]; outcome?: string; tied?: boolean };
const throws = ref<ThrowResult[]>([
  { id: "sample-rowan", character: "Rowan Ash", weapon: "Longsword", dice: [{ attribute: "DEX", size: 8, face: 4 }, { attribute: "MIG", size: 10, face: 8 }], bonus: 1, total: 13, special: "" },
  { id: "sample-nera", character: "Nera Vale", weapon: "Dagger", dice: [{ attribute: "DEX", size: 8, face: 6 }, { attribute: "INS", size: 10, face: 6 }], bonus: 1, total: 13, special: "Critical success" },
  ...Array.from({ length: 18 }, (_, index) => {
    const isRowan = index % 2 === 0;
    const firstFace = (index % 8) + 1;
    const secondFace = ((index * 3 + 2) % 10) + 1;
    return {
      id: `sample-history-${index}`,
      character: isRowan ? "Rowan Ash" : "Nera Vale",
      weapon: isRowan ? "Longsword" : "Dagger",
      dice: [{ attribute: "DEX", size: 8, face: firstFace }, { attribute: isRowan ? "MIG" : "INS", size: 10, face: secondFace }],
      bonus: 1,
      total: firstFace + secondFace + 1,
      special: firstFace === 1 && secondFace === 1 ? "Fumble" : firstFace === secondFace && firstFace >= 6 ? "Critical success" : "",
    };
  }),
  {
    id: "sample-opposed-win", character: "Rowan Ash", weapon: "Opposed check",
    dice: [{ attribute: "DEX", size: 8, face: 5 }, { attribute: "MIG", size: 10, face: 7 }], bonus: 1, total: 13, special: "",
    opponent: { name: "Opponent", dice: [{ attribute: "DEX", size: 8, face: 3 }, { attribute: "MIG", size: 10, face: 5 }], bonus: 0, total: 8, special: "" },
    outcome: "Rowan Ash wins",
  },
  {
    id: "sample-opposed-tie", character: "Nera Vale", weapon: "Opposed check",
    dice: [{ attribute: "DEX", size: 8, face: 5 }, { attribute: "INS", size: 10, face: 4 }], bonus: 0, total: 9, special: "",
    opponent: { name: "Opponent", dice: [{ attribute: "DEX", size: 6, face: 3 }, { attribute: "INS", size: 8, face: 6 }], bonus: 0, total: 9, special: "" },
    opposedSides: [
      { name: "Nera Vale", dice: [{ attribute: "DEX", size: 8 }, { attribute: "INS", size: 10 }], modifier: 0 },
      { name: "Opponent", dice: [{ attribute: "DEX", size: 6 }, { attribute: "INS", size: 8 }], modifier: 0 },
    ],
    tied: true, outcome: "Tie — reroll",
  },
]);
const historyList = ref<HTMLOListElement>();
const highlightedThrow = ref("");
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => { void nextTick(() => historyList.value?.scrollTo({ top: historyList.value.scrollHeight })); });
onUnmounted(() => clearTimeout(highlightTimer));

function addThrow(result: Omit<ThrowResult, "id">) {
  const id = crypto.randomUUID();
  throws.value.push({ ...result, id });
  highlightedThrow.value = id;
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => { highlightedThrow.value = ""; }, 1000);
  void nextTick(() => historyList.value?.scrollTo({ top: historyList.value.scrollHeight }));
}
const throwError = ref("");
const rollOpen = ref(false);
const freeRollOpen = ref(false);
const freeCharacterId = ref("gm");
const freeDice = [4, 6, 8, 10, 12, 20] as const;
const freePool = ref<number[]>([]);
const freeModifier = ref("0");
const freeNote = ref("");
const freeError = ref("");
const newOpponent = (): OpponentDraft => ({ dice: [], modifier: "0" });
const opponent = ref<OpponentDraft>(newOpponent());
const rollDraft = ref<{ person: PartyMember; weapon: string; first: Attribute; second: Attribute | null; dice: PartyMember["baseDice"]; weaponBonus: number; modifier: string; note: string; attributeCheck: boolean }>();
const selectedSheet = computed(() => currentParty.value.find((person) => person.id === selectedSheetId.value)!);
const tabs = party.map((person) => ({ label: person.name, value: person.id }));
const sheets = ref(Object.fromEntries(party.map((person) => [person.id, toCharacter({
  name: person.name, theme: null, level: 5, baseDice: person.baseDice,
  classes: sheetFixtures[person.id]!.classes, skills: [], equipment: sheetFixtures[person.id]!.equipment,
  resources: { hp: person.hp.current, mp: person.mp.current, ip: person.ip.current, fabula: person.fabula },
  overrides: sheetFixtures[person.id]!.overrides,
}, person.id, false)])));
const currentParty = computed(() => party.map((person) => {
  const sheet = sheets.value[person.id]!;
  return {
    ...person,
    hp: { ...person.hp, current: sheet.current.HP ?? person.hp.current },
    mp: { ...person.mp, current: sheet.current.MP ?? person.mp.current },
    ip: { ...person.ip, current: sheet.current.IP ?? person.ip.current },
    fabula: sheet.current.Fabula,
    baseDice: Object.fromEntries(Object.entries(sheet.attributes).map(([key, value]) => [key, Number(value)])) as PartyMember["baseDice"],
  };
}));

function prepareWeaponRoll(person: PartyMember, weapon: NamedEntry) {
  const settings = weapon.weapon;
  const first = settings?.attributes[0];
  const second = settings?.attributes[1];
  if (!first || !second || settings?.accuracyBonus == null) {
    throwError.value = `Set both attributes and the accuracy bonus for ${weapon.name} on the character sheet.`;
    return;
  }
  throwError.value = "";
  rollDraft.value = { person, weapon: weapon.name, first, second, dice: { ...person.baseDice }, weaponBonus: settings.accuracyBonus, modifier: "0", note: "", attributeCheck: false };
  rollOpen.value = true;
}

function prepareAttributeRoll(person: PartyMember, attribute: Attribute) {
  throwError.value = "";
  opponent.value = newOpponent();
  rollDraft.value = { person, weapon: "Attribute check", first: attribute, second: null, dice: { ...person.baseDice }, weaponBonus: 0, modifier: "0", note: "", attributeCheck: true };
  rollOpen.value = true;
}

function addOpposedThrow(sides: [OpposedSide, OpposedSide], note: string, actor?: string) {
  const result = rollOpposed(sides);
  addThrow({ character: result.first.name, actor, weapon: result.fabulaCheck ? "Opposed check" : "Opposed roll", dice: result.first.dice, bonus: result.first.bonus, total: result.first.total, special: result.first.special, opponent: result.second, opposedSides: sides, tied: result.winner === null, outcome: result.winner === null ? "Tie — reroll" : `${sides[result.winner]!.name} wins`, note });
}

function rerollThrow(previous: ThrowResult) {
  opponent.value = { dice: previous.opponent?.dice.map((die) => die.size) ?? [], modifier: String(previous.opponent?.bonus ?? 0) };
  const person = currentParty.value.find((member) => member.name === previous.character);
  const first = previous.dice[0];
  const second = previous.dice[1];
  const isAttribute = (value: string): value is Attribute => (attributes as readonly string[]).includes(value);
  if (person && first && isAttribute(first.attribute) && (!second || isAttribute(second.attribute))) {
    const dice = { ...person.baseDice, [first.attribute]: first.size, ...(second ? { [second.attribute]: second.size } : {}) } as PartyMember["baseDice"];
    const attributeCheck = ["Attribute check", "Attribute roll", "Opposed check"].includes(previous.weapon);
    const weaponBonus = attributeCheck ? 0 : previous.weaponBonus ?? sheets.value[person.id]?.equipment.find((item) => item.name === previous.weapon)?.weapon?.accuracyBonus ?? 0;
    rollDraft.value = { person, weapon: attributeCheck ? "Attribute check" : previous.weapon, first: first.attribute, second: second && isAttribute(second.attribute) ? second.attribute : null, dice, weaponBonus, modifier: String(previous.bonus - weaponBonus), note: previous.note ?? "", attributeCheck };
    throwError.value = "";
    rollOpen.value = true;
    return;
  }
  freePool.value = previous.dice.map((die) => die.size);
  freeModifier.value = String(previous.bonus);
  freeNote.value = previous.note ?? "";
  freeCharacterId.value = currentParty.value.find((member) => member.name === previous.character && member.controller === "GM")?.id ?? "gm";
  freeError.value = "";
  freeRollOpen.value = true;
}

function getOpponentModifier(): number | null {
  const modifier = opponent.value.modifier.trim();
  return modifier && Number.isSafeInteger(Number(modifier)) ? Number(modifier) : null;
}

function rollWeapon() {
  const draft = rollDraft.value;
  if (!draft) return;
  if (draft.modifier === "" || !Number.isSafeInteger(Number(draft.modifier))) {
    throwError.value = "Enter a whole number for the additional modifier.";
    return;
  }
  const { person, weapon, first, second } = draft;
  const firstSize = draft.dice[first];
  const secondSize = second ? draft.dice[second] : undefined;
  const bonus = draft.weaponBonus + Number(draft.modifier);
  throwError.value = "";
  if (draft.attributeCheck && opponent.value.dice.length) {
    if (opponent.value.dice.length !== 2) { throwError.value = "Choose two opposing dice, or remove them for an unopposed check."; return; }
    if (opponent.value.dice.length === 2 && first === second && opponent.value.dice[0] !== opponent.value.dice[1]) { throwError.value = "The same attribute uses the same die size twice."; return; }
    const opponentBonus = getOpponentModifier();
    if (opponentBonus === null) { throwError.value = "Enter a whole number for the opponent modifier."; return; }
    addOpposedThrow([
      { name: person.name, dice: [{ attribute: first, size: firstSize }, ...(second && secondSize ? [{ attribute: second, size: secondSize }] : [])], modifier: bonus },
      { name: "Opponent", dice: opponent.value.dice.map((size, index) => ({ attribute: index === 0 ? first : index === 1 && second ? second : `d${size}`, size })), modifier: opponentBonus },
    ], draft.note.trim());
    rollOpen.value = false;
    return;
  }
  const firstFace = Math.floor(Math.random() * firstSize) + 1;
  const secondFace = secondSize ? Math.floor(Math.random() * secondSize) + 1 : undefined;
  addThrow({
    character: person.name,
    weapon: draft.attributeCheck && !second ? "Attribute roll" : weapon,
    weaponBonus: draft.weaponBonus,
    dice: [{ attribute: first, size: firstSize, face: firstFace }, ...(second && secondSize && secondFace ? [{ attribute: second, size: secondSize, face: secondFace }] : [])],
    bonus,
    note: draft.note.trim(),
    total: firstFace + (secondFace ?? 0) + bonus,
    special: secondFace === undefined ? "" : firstFace === 1 && secondFace === 1 ? "Fumble" : firstFace === secondFace && firstFace >= 6 ? "Critical success" : "",
  });
  rollOpen.value = false;
}

function makeFreeRoll() {
  if (freePool.value.length < 1 || freePool.value.length > 2) {
    freeError.value = "Choose one or two friendly dice.";
    return;
  }
  if (freeModifier.value.trim() === "" || !Number.isSafeInteger(Number(freeModifier.value))) {
    freeError.value = "Enter a whole number for the modifier.";
    return;
  }
  const bonus = Number(freeModifier.value);
  const actor = props.role === "GM" ? "GM" : "Player";
  const character = props.role === "GM"
    ? currentParty.value.find((person) => person.id === freeCharacterId.value && person.controller === "GM")?.name ?? ""
    : currentParty.value.find((person) => person.controller === "demo-player")?.name ?? "";
  if (opponent.value.dice.length) {
    const opponentBonus = getOpponentModifier();
    if (opponent.value.dice.length !== 2 || freePool.value.length !== 2) { freeError.value = "An opposed check requires two dice on each side."; return; }
    if (freePool.value.some((size) => !dieSizes.includes(size as (typeof dieSizes)[number]))) { freeError.value = "Use d6, d8, d10 or d12 for an opposed check."; return; }
    if (opponentBonus === null) { freeError.value = "Enter a whole number for the opponent modifier."; return; }
    addOpposedThrow([
      { name: character || actor, dice: freePool.value.map((size) => ({ attribute: `d${size}`, size })), modifier: bonus },
      { name: "Opponent", dice: opponent.value.dice.map((size) => ({ attribute: `d${size}`, size })), modifier: opponentBonus },
    ], freeNote.value.trim(), character ? actor : undefined);
    freeError.value = "";
    freeRollOpen.value = false;
    return;
  }
  const dice = freePool.value.map((size) => ({ attribute: `d${size}`, size, face: Math.floor(Math.random() * size) + 1 }));
  addThrow({ character, actor, weapon: "Dice roll", dice, bonus, total: dice.reduce((sum, die) => sum + die.face, bonus), special: "", note: freeNote.value.trim() });
  freeError.value = "";
  freeRollOpen.value = false;
}

</script>

<template>
  <main class="mx-auto max-w-6xl space-y-section p-section">
    <header class="flex flex-wrap items-start justify-between gap-medium">
      <div>
        <h1 class="text-heading font-semibold">{{ showSettings ? "Settings" : "The Lantern Road" }}</h1>
        <p class="text-muted">The Lantern Road · Fabula Ultima · {{ role }}</p>
      </div>
      <UButton v-if="role === 'GM'" color="neutral" variant="outline" @click="showSettings = !showSettings">{{ showSettings ? "Return to game" : "Settings" }}</UButton>
    </header>
    <div v-show="showSettings" class="space-y-section">
      <section class="space-y-medium rounded-panel border border-default p-large">
        <h2 class="text-section font-semibold">Players</h2>
        <div class="flex flex-wrap items-center justify-between gap-small">
          <span>demo-player <UBadge color="neutral" variant="subtle">{{ playerActive ? "Active" : "Removed" }}</UBadge></span>
          <UButton color="neutral" variant="outline" @click="playerActive = !playerActive">{{ playerActive ? "Remove access" : "Restore access" }}</UButton>
        </div>
      </section>
      <section class="space-y-medium rounded-panel border border-default p-large">
        <h2 class="text-section font-semibold">Invitations</h2>
        <p class="text-sm text-muted">Prototype controls use sample data.</p>
        <UButton v-if="!invitationCreated" @click="invitationCreated = true">Create game link</UButton>
        <div v-else class="space-y-small rounded-panel border border-default p-medium">
          <div class="flex items-center gap-small"><strong>Game link</strong><UBadge color="neutral" variant="subtle">{{ invitationEnabled ? "Enabled" : "Disabled" }}</UBadge></div>
          <p class="text-sm text-muted">Sample invitation link</p>
          <UButton color="neutral" variant="outline" @click="invitationEnabled = !invitationEnabled">{{ invitationEnabled ? "Disable" : "Enable" }}</UButton>
        </div>
      </section>
    </div>
    <div v-show="!showSettings" class="grid gap-section lg:grid-cols-2">
      <section aria-labelledby="party-heading" class="rounded-panel border border-default p-large">
        <h2 id="party-heading" class="text-section font-semibold">
          Active party
        </h2>
        <PartyOverview :party="currentParty" :sheets="sheets" @roll-weapon="prepareWeaponRoll" @roll-attribute="prepareAttributeRoll" />
      </section>
      <section aria-labelledby="roll-history-heading" class="history-panel space-y-medium rounded-panel border border-default p-large">
        <div class="flex flex-wrap items-center justify-between gap-small">
          <h2 id="roll-history-heading" class="text-section font-semibold">Throw history</h2>
          <UButton color="neutral" variant="outline" @click="freePool = []; opponent = newOpponent(); freeRollOpen = true">Make a roll</UButton>
        </div>
        <p v-if="throwError" role="alert" class="text-error">{{ throwError }}</p>
        <p v-if="!throws.length" class="text-muted">No throws yet.</p>
        <ol v-else ref="historyList" class="throw-history space-y-small" aria-live="polite" aria-label="Recent throws" tabindex="0">
          <li v-for="(throwResult, index) in throws" :key="throwResult.id" class="rounded-panel border border-default p-small" :class="{ 'throw-highlight': highlightedThrow === throwResult.id }">
            <div class="flex items-start justify-between gap-small">
              <p class="font-semibold">{{ throwResult.actor ? `${throwResult.actor} · ` : '' }}{{ throwResult.character ? `${throwResult.character} · ` : '' }}{{ throwResult.weapon }}</p>
              <div class="flex items-center gap-tight">
                <UButton color="neutral" variant="ghost" size="xs" :aria-label="`Reroll ${throwResult.weapon}`" @click="rerollThrow(throwResult)">Reroll</UButton>
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="`Remove ${throwResult.weapon} throw`" @click="throws.splice(index, 1)" />
              </div>
            </div>
            <div class="throw-dice" :aria-label="throwResult.dice.map((die) => `${die.attribute} d${die.size}: ${die.face}`).join(', ') + (throwResult.bonus ? `; modifier ${throwResult.bonus}` : '') + (throwResult.opponent ? '; opponent: ' + throwResult.opponent.dice.map((die) => `${die.attribute} d${die.size}: ${die.face}`).join(', ') + (throwResult.opponent.bonus ? `; modifier ${throwResult.opponent.bonus}` : '') : '')">
              <span v-for="(die, dieIndex) in throwResult.dice" :key="dieIndex" class="throw-die" aria-hidden="true">
                <span class="throw-die-symbol"><span class="throw-die-label">{{ die.attribute }}</span><DieIcon :sides="die.size" /></span>
                <span class="die-face">{{ die.face }}</span>
              </span>
              <strong v-if="throwResult.bonus !== 0" class="text-sm text-highlighted">{{ throwResult.bonus < 0 ? '−' : '+' }} {{ Math.abs(throwResult.bonus) }}</strong>
              <template v-if="throwResult.opponent">
                <span class="text-sm text-muted" aria-hidden="true">vs</span>
                <span v-for="(die, dieIndex) in throwResult.opponent.dice" :key="`opponent-${dieIndex}`" class="throw-die opponent-die-result" aria-hidden="true">
                  <span class="throw-die-symbol"><span class="throw-die-label">{{ die.attribute }}</span><DieIcon :sides="die.size" /></span><span class="die-face">{{ die.face }}</span>
                </span>
                <strong v-if="throwResult.opponent.bonus" class="text-sm">{{ throwResult.opponent.bonus < 0 ? '−' : '+' }} {{ Math.abs(throwResult.opponent.bonus) }}</strong>
              </template>
            </div>
            <p>{{ ['Attribute check', 'Attribute roll', 'Dice roll', 'Opposed check', 'Opposed roll'].includes(throwResult.weapon) ? 'Total' : 'Accuracy' }}: <strong>{{ throwResult.total }}</strong><span v-if="throwResult.special"> ({{ throwResult.special }})</span><template v-if="throwResult.opponent"> vs <strong>{{ throwResult.opponent.total }}</strong><span v-if="throwResult.opponent.special"> ({{ throwResult.opponent.special }})</span> · {{ throwResult.outcome }}</template></p>
            <p v-if="throwResult.note" class="text-sm text-muted">{{ throwResult.note }}</p>
          </li>
        </ol>
      </section>
    </div>
    <UModal v-model:open="freeRollOpen" title="Make a roll" description="Choose dice and an optional modifier.">
      <template #body>
        <form class="space-y-medium" @submit.prevent="makeFreeRoll">
          <UFormField v-if="role === 'GM'" label="Roll as">
            <USelect v-model="freeCharacterId" :items="[{ label: 'GM', value: 'gm' }, ...currentParty.filter((person) => person.controller === 'GM').map((person) => ({ label: person.name, value: person.id }))]" class="w-full" />
          </UFormField>
          <p v-else class="text-sm text-muted">Rolling as {{ currentParty.find((person) => person.controller === 'demo-player')?.name ?? 'Player (no active character)' }}.</p>
          <p class="text-sm font-medium">Friendly dice</p>
          <div class="flex flex-wrap items-center gap-small" aria-label="Add dice and modifier">
            <UTooltip v-for="size in freeDice" :key="size" :disabled="freePool.length < 2 && !(opponent.dice.length > 0 && !dieSizes.includes(size as (typeof dieSizes)[number]))" :text="freePool.length >= 2 ? 'Maximum 2 dice' : 'Opposed checks use d6, d8, d10 or d12'" :content="{ side: 'top' }">
              <span class="dice-trigger" :tabindex="freePool.length >= 2 || (opponent.dice.length > 0 && !dieSizes.includes(size as (typeof dieSizes)[number])) ? 0 : undefined">
                <button type="button" class="free-die-button" :aria-label="`Add d${size} to dice pool`" :disabled="freePool.length >= 2 || (opponent.dice.length > 0 && !dieSizes.includes(size as (typeof dieSizes)[number]))" @click="freePool.push(size); freeError = ''">
                  <DieIcon :sides="size" /><span>d{{ size }}</span>
                </button>
              </span>
            </UTooltip>
            <label class="modifier-card"><span>Modifier</span><input v-model="freeModifier" type="number" step="1" /></label>
          </div>
          <OpposedSetup v-model="opponent" :show-pool="false" />
          <div>
            <p class="mb-small text-sm font-medium">Dice pool</p>
            <div v-if="freePool.length || opponent.dice.length" class="flex flex-wrap gap-small">
              <button v-for="(size, index) in freePool" :key="index" type="button" class="free-die-button" :aria-label="`Remove d${size} from dice pool`" @click="freePool.splice(index, 1); freeError = ''"><DieIcon :sides="size" /><span>d{{ size }}</span></button>
              <button v-for="(size, index) in opponent.dice" :key="`opponent-${index}`" type="button" class="free-die-button opposing-pool-die" :aria-label="`Remove opposing d${size} from dice pool`" @click="opponent.dice.splice(index, 1); freeError = ''"><DieIcon :sides="size" /><span>d{{ size }}</span></button>
            </div>
            <p v-else class="text-sm text-muted">Select dice to add them to the pool.</p>
          </div>
          <UFormField label="Note" hint="Optional"><UInput v-model="freeNote" class="w-full" /></UFormField>
          <p v-if="freeError" role="alert" class="text-error">{{ freeError }}</p>
          <div class="flex justify-end gap-small"><UButton type="button" color="neutral" variant="outline" @click="freeRollOpen = false">Cancel</UButton><UButton type="submit">Roll</UButton></div>
        </form>
      </template>
    </UModal>
    <UModal v-model:open="rollOpen" :title="rollDraft ? `${rollDraft.person.name} · ${rollDraft.attributeCheck ? 'Attribute check' : rollDraft.weapon}` : 'Roll'">
      <template #description>
        Adjust dice for temporary effects. These choices only apply to this roll.
      </template>
      <template #body>
        <form v-if="rollDraft" class="space-y-medium" @submit.prevent="rollWeapon">
          <div class="space-y-small">
            <template v-for="(attribute, index) in [rollDraft.first, rollDraft.second].filter((value): value is Attribute => value !== null)" :key="index">
              <div class="flex flex-wrap items-end gap-medium">
                <fieldset v-if="index === 0 || attribute !== rollDraft.first">
                  <legend class="mb-small text-sm font-medium">{{ attribute }} die</legend>
                  <div class="flex flex-wrap gap-small">
                    <label v-for="size in dieSizes" :key="size" class="die-choice">
                      <input v-model="rollDraft.dice[attribute]" class="sr-only" type="radio" :name="`die-${attribute}`" :value="size" />
                      <span class="die-choice-content"><DieIcon :sides="size" /><span>d{{ size }}</span></span>
                    </label>
                  </div>
                </fieldset>
                <UFormField v-if="index === 0" label="Check modifier" class="w-28">
                  <UInput v-model="rollDraft.modifier" type="number" step="1" class="w-full" />
                </UFormField>
              </div>
              <fieldset v-if="index === 0 && rollDraft.attributeCheck">
                <legend class="mb-small text-sm font-medium">Second attribute <span class="text-muted">(optional)</span></legend>
                <div class="flex flex-wrap gap-small">
                  <button v-for="choice in attributes" :key="choice" type="button" class="attribute-choice die-choice-content" :aria-pressed="rollDraft.second === choice" @click="rollDraft.second = rollDraft.second === choice ? null : choice">{{ choice }}</button>
                </div>
              </fieldset>
            </template>
          </div>
          <p v-if="!rollDraft.attributeCheck">Weapon accuracy bonus: <strong>{{ rollDraft.weaponBonus >= 0 ? '+' : '' }}{{ rollDraft.weaponBonus }}</strong></p>
          <OpposedSetup v-if="rollDraft.attributeCheck" v-model="opponent" />
          <UFormField label="Note" hint="Optional"><UInput v-model="rollDraft.note" class="w-full" /></UFormField>
          <p v-if="throwError" role="alert" class="text-error">{{ throwError }}</p>
          <div class="flex justify-end gap-small"><UButton type="button" color="neutral" variant="outline" @click="rollOpen = false">Cancel</UButton><UButton type="submit">Roll</UButton></div>
        </form>
      </template>
    </UModal>
    <USlideover v-model:open="sheetOpen" title="Character sheets" :ui="{ content: 'w-full sm:max-w-4xl' }">
      <UButton v-show="!showSettings" class="sheet-bookmark" color="primary" data-testid="open-character-sheets">Character sheets</UButton>
      <template #body>
        <UButton class="sheet-bookmark sheet-bookmark-close" color="primary" data-testid="close-character-sheets" aria-label="Close character sheets" @click="sheetOpen = false">Character sheets</UButton>
        <UTabs v-model="selectedSheetId" :items="tabs" :ui="{ list: 'max-w-full overflow-x-auto', trigger: 'flex-none', content: 'min-w-0' }">
          <template #content>
              <CharacterSheet
                :character="sheets[selectedSheet.id]!"
                :controller="selectedSheet.controller === 'GM' ? 'the GM' : selectedSheet.controller"
                :maximum="{ HP: selectedSheet.hp.max, MP: selectedSheet.mp.max, IP: selectedSheet.ip.max }"
                :maximum-overrides="{ HP: null, MP: null, IP: null }"
                :base-defense="{ DEF: null, 'MAG DEF': null, INIT: null }"
                :defense-details="{ DEF: [], 'MAG DEF': [], INIT: [] }"
              />
          </template>
        </UTabs>
      </template>
    </USlideover>
  </main>
</template>

<style scoped>
.opponent-die-result :deep(.die-icon) { color: var(--ui-error); }
.throw-history { max-height: min(60vh, 36rem); overflow-y: auto; overscroll-behavior: contain; }
@media (min-width: 1024px) {
  .history-panel { display: flex; flex-direction: column; height: 0; min-height: 100%; }
  .throw-history { flex: 1; min-height: 0; max-height: none; }
}
.throw-highlight { animation: new-throw 1s ease-out; }
@keyframes new-throw {
  0% { transform: scale(0.97); border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
  35% { transform: scale(1); border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
  60% { transform: scale(0.99); }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .throw-highlight { animation: none; border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
}
.free-die-button { min-width: 2.75rem; display: grid; justify-items: center; gap: 0.125rem; padding: 0.25rem 0.375rem; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; font-weight: 700; cursor: pointer; }
.free-die-button :deep(.die-icon) { width: 1.25rem; height: 1.25rem; }
.opposing-pool-die :deep(.die-icon) { color: var(--ui-error); }
.free-die-button:hover { border-color: var(--ui-primary); }
.free-die-button:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.free-die-button:disabled { opacity: 0.5; cursor: not-allowed; }
.dice-trigger { display: inline-flex; }
.dice-trigger button:disabled { pointer-events: none; }
.dice-trigger:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; border-radius: var(--radius-panel); }
.modifier-card { min-height: 2.75rem; display: grid; align-content: center; justify-items: center; gap: 0.125rem; padding: 0.25rem 0.375rem; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; font-weight: 700; }
.modifier-card input { width: 3rem; min-width: 0; appearance: textfield; text-align: center; color: var(--ui-text-highlighted); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); }
.modifier-card input::-webkit-inner-spin-button, .modifier-card input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.die-choice { cursor: pointer; }
.die-choice-content { display: flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.5rem; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); font-size: 0.875rem; }
.die-choice-content :deep(.die-icon) { width: 1.25rem; height: 1.25rem; }
.die-choice input:checked + .die-choice-content { border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
.die-choice input:focus-visible + .die-choice-content { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.attribute-choice[aria-pressed="true"] { border-color: var(--ui-primary); background: var(--ui-bg-elevated); }
.attribute-choice:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.throw-dice, .throw-die { display: flex; align-items: center; gap: 0.375rem; }
.throw-dice { flex-wrap: wrap; gap: 0.75rem; margin: 0.375rem 0; }
.throw-die :deep(.die-icon) { width: 1.25rem; height: 1.25rem; }
.throw-die-symbol { display: grid; justify-items: center; gap: 0.125rem; }
.throw-die-label { color: var(--ui-text-muted); font-size: 0.625rem; font-weight: 600; line-height: 1; }
.die-face { display: grid; place-items: center; width: 1.75rem; height: 1.6rem; color: var(--ui-text-highlighted); background: var(--ui-bg-elevated); clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); font-weight: 700; font-size: 0.875rem; }
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
