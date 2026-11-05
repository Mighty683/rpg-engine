<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useToast } from "@nuxt/ui/composables";
import NamedEntries from "./NamedEntries.vue";
import InfoTooltip from "../design-system/InfoTooltip.vue";
import DieIcon from "../design-system/DieIcon.vue";
import { createMockApi, type Character, type Game, type Player } from "./mock-api";

const toast = useToast();
type Screen = "games" | "create" | "game" | "player" | "setup";
const screen = ref<Screen>("setup");
const heading = ref<HTMLElement>();
const mockApi = createMockApi();
const games = ref(mockApi.games);
const game = ref<Game>(games.value[0]!);
const gameName = ref("");
const system = ref("");
const playerName = ref("");
const player = ref<Player>(game.value.players[0]!);
const character = ref<Character>(player.value.characters[0]!);
const listState = ref("ready");
const formError = ref("");
const hasPlayer = computed(() => game.value.players.some((entry) => entry.id === player.value?.id));
const navOpen = ref(false);
const hasCharacter = computed(() => hasPlayer.value && player.value.characters.some((entry) => entry.id === character.value?.id));
const navigationItems = computed(() => [
  { label: "Games", active: screen.value === "games" || screen.value === "create", onSelect: () => navigate("games") },
  { label: game.value.name, active: screen.value === "game", onSelect: () => navigate("game") },
  ...(hasPlayer.value ? [{ label: player.value.name, active: screen.value === "player", onSelect: () => navigate("player") }] : []),
  ...(hasCharacter.value ? [{ label: character.value.identity.name || "Character", active: screen.value === "setup", onSelect: () => navigate("setup") }] : []),
]);
function navigate(target: Screen) { navOpen.value = false; void show(target); }
const identity = computed(() => character.value.identity);
const editingLocked = computed(() => character.value.editingLocked);
const classes = computed(() => character.value.classes);
const level = computed(() => character.value.level);
function setLevel(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.valueAsNumber;
  const nextLevel = Number.isFinite(value) ? Math.min(50, Math.max(5, Math.trunc(value))) : character.value.level;
  if (nextLevel !== character.value.level) {
    current.value.HP ??= maximum.value.HP;
    current.value.MP ??= maximum.value.MP;
  }
  character.value.level = nextLevel;
  input.value = String(character.value.level);
}
const skills = computed(() => character.value.skills);
const attributes = computed(() => character.value.attributes);
const equipment = computed(() => character.value.equipment);
const current = computed(() => character.value.current);
const overrides = computed(() => character.value.overrides);
const selectedClasses = computed(() => new Set(classes.value.map((entry) => entry.name.trim().toLowerCase())));
const maximum = computed(() => ({
  HP: level.value + 5 * Number(attributes.value.MIG) + [...selectedClasses.value].filter((name) => ["weaponmaster", "guardian"].includes(name)).length * 5,
  MP: level.value + 5 * Number(attributes.value.WLP) + (selectedClasses.value.has("orator") ? 5 : 0),
  IP: 6 + (selectedClasses.value.has("rogue") ? 2 : 0),
}));
const equippedArmor = computed(() => equipment.value.find((item) => item.itemType === "armor" && item.defenseKind === "armor" && item.equipped));
const equippedShield = computed(() => equipment.value.find((item) => item.itemType === "armor" && item.defenseKind === "shield" && item.equipped));
const baseDefense = computed(() => {
  const armor = equippedArmor.value?.armor;
  const shield = equippedShield.value?.shield;
  return {
    DEF: (armor?.fixedDefense ?? (Number(attributes.value.DEX) + (armor?.physicalBonus ?? 0))) + (shield?.physicalBonus ?? 0),
    "MAG DEF": Number(attributes.value.INS) + (armor?.magicBonus ?? 0) + (shield?.magicBonus ?? 0),
    INIT: (armor?.initiative ?? 0) + (shield?.initiative ?? 0),
  };
});
type DefenseContribution = { name: string; value: number; modifier?: boolean };
const defenseDetails = computed(() => {
  const armor = equippedArmor.value?.armor;
  const shield = equippedShield.value?.shield;
  const physicalBase: DefenseContribution = armor?.fixedDefense == null
    ? { name: "DEX", value: Number(attributes.value.DEX) }
    : { name: `${equippedArmor.value?.name} (fixed)`, value: armor.fixedDefense };
  const contributions = (base: DefenseContribution, extras: Array<[string, number]>): DefenseContribution[] => [
    base,
    ...extras.filter(([, value]) => value !== 0).map(([name, value]) => ({ name, value, modifier: true })),
  ];
  return {
    DEF: contributions(physicalBase, [[equippedArmor.value?.name || "Armor", armor?.fixedDefense == null ? armor?.physicalBonus ?? 0 : 0], [equippedShield.value?.name || "Shield", shield?.physicalBonus ?? 0]]),
    "MAG DEF": contributions({ name: "INS", value: Number(attributes.value.INS) }, [[equippedArmor.value?.name || "Armor", armor?.magicBonus ?? 0], [equippedShield.value?.name || "Shield", shield?.magicBonus ?? 0]]),
    INIT: contributions({ name: "Base", value: 0 }, [[equippedArmor.value?.name || "Armor", armor?.initiative ?? 0], [equippedShield.value?.name || "Shield", shield?.initiative ?? 0]]),
  };
});
const attributeHelp = { DEX: "Dexterity measures agility and is the usual base for Defense.", INS: "Insight measures awareness and is the base for Magic Defense.", MIG: "Might measures physical strength and contributes to maximum HP.", WLP: "Willpower measures resolve and contributes to maximum MP." };
const defenseHelp = { DEF: "Defense is the difficulty for attacks targeting physical Defense.", "MAG DEF": "Magic Defense is the difficulty for effects targeting Magic Defense.", INIT: "Initiative modifies checks to determine turn order." };
function warnIfEditingLocked(event: PointerEvent) {
  if (!editingLocked.value || !(event.target instanceof Element)) return;
  if (event.target.closest(".sheet-name, .theme-field, .level-mark, .die, .resource, .defense-stat, .detail-card, .entry-add")) {
    toast.add({ id: "editing-locked", title: "Editing is locked", description: "Unlock editing to make changes.", color: "warning" });
  }
}
async function show(next: Screen) { screen.value = next; formError.value = ""; await nextTick(); heading.value?.focus(); }
function createGame() {
  if (!gameName.value.trim() || !system.value) { formError.value = "Enter a game name and choose a system."; return; }
  const created = mockApi.createGame(gameName.value.trim(), system.value);
  games.value.unshift(created); game.value = games.value[0]!; gameName.value = ""; system.value = ""; toast.add({ title: "Game created", color: "success" }); void show("game");
}
function openGame(selected: Game) { game.value = selected; void show("game"); }
function addPlayer() {
  if (!playerName.value.trim()) { formError.value = "Enter a player name."; return; }
  game.value.players.push(mockApi.createPlayer(playerName.value.trim())); player.value = game.value.players.at(-1)!; playerName.value = ""; toast.add({ title: "Player added", color: "success" }); void show("player");
}
function openPlayer(selected: Player) { player.value = selected; void show("player"); }
function createCharacter() { player.value.characters.push(mockApi.createCharacter()); character.value = player.value.characters.at(-1)!; void show("setup"); }
function openCharacter(selected: Character) { character.value = selected; void show("setup"); }
</script>

<template>
  <UContainer class="py-small">
    <div class="mx-auto max-w-6xl space-y-small">
      <div v-if="screen !== 'setup'" class="flex flex-wrap items-center justify-between gap-medium border-b border-default pb-large">
        <div><p class="text-muted">Character setup</p><p class="font-semibold">A place for every adventurer</p></div>
        <div class="flex flex-wrap items-center gap-medium text-muted"><label for="list-state">List state</label><select id="list-state" v-model="listState" class="rounded-panel border border-default bg-default p-small"><option value="ready">Ready</option><option value="loading">Loading</option><option value="error">Error</option><option value="empty">Empty</option></select></div>
      </div>

      <div class="prototype-layout">
        <USidebar collapsible="none" title="Navigation" class="hidden lg:flex">
          <UNavigationMenu :items="navigationItems" orientation="vertical" aria-label="Game navigation" />
        </USidebar>
        <div class="lg:hidden">
          <USlideover v-model:open="navOpen" title="Navigation" side="left">
            <UButton color="neutral" variant="outline">Menu</UButton>
            <template #body><UNavigationMenu :items="navigationItems" orientation="vertical" aria-label="Game navigation" /></template>
          </USlideover>
        </div>
        <div class="prototype-content space-y-medium">
      <template v-if="screen === 'games'">
        <div class="flex flex-wrap items-end justify-between gap-large"><div><p class="text-muted">YOUR CAMPAIGNS</p><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">Games</h1><p class="mt-small text-muted">Gather your players and bring their stories to life.</p></div><UButton @click="show('create')">Create game</UButton></div>
        <p v-if="listState === 'loading'" role="status">Loading games…</p><div v-else-if="listState === 'error'" role="alert"><p>Could not load games.</p><UButton class="mt-small" variant="outline" @click="listState = 'ready'">Retry</UButton></div><p v-else-if="listState === 'empty' || !games.length" class="rounded-panel border border-default p-section text-muted">No games yet. Create your first game.</p>
        <div v-else class="grid gap-large md:grid-cols-2"><button v-for="item in games" :key="item.name" type="button" class="rounded-panel border border-default bg-muted p-section text-left hover:bg-elevated" @click="openGame(item)"><span class="text-muted">{{ item.system }}</span><span class="mt-small block text-section font-semibold">{{ item.name }}</span><span class="mt-large block font-medium">Open game →</span></button></div>
      </template>
      <template v-else-if="screen === 'create'">
        <UButton variant="ghost" @click="show('games')">← Games</UButton><div class="max-w-xl space-y-section"><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">Create game</h1><form class="space-y-field" @submit.prevent="createGame"><label class="block font-medium">Game name<input v-model="gameName" maxlength="20" class="mt-small block w-full rounded-panel border border-default bg-default p-medium" /></label><label class="block font-medium">RPG system<select v-model="system" class="mt-small block w-full rounded-panel border border-default bg-default p-medium"><option value="">Select a system</option><option>Fabula Ultima</option><option>Dungeons &amp; Dragons 5e</option></select></label><p class="text-muted">The system cannot be changed after the game is created.</p><p v-if="formError" role="alert" class="text-error">{{ formError }}</p><div class="flex gap-medium"><UButton type="submit">Create game</UButton><UButton variant="outline" @click="show('games')">Cancel</UButton></div></form></div>
      </template>
      <template v-else-if="screen === 'game'">
        <div class="flex flex-wrap items-baseline gap-medium"><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">{{ game.name }}</h1><span class="text-muted">{{ game.system }}</span></div>
        <div v-if="game.system !== 'Fabula Ultima'" class="rounded-panel border border-default p-large">Fabula Ultima character setup is available for Fabula Ultima games.</div>
        <section class="space-y-large"><h2 class="text-section font-semibold">Players</h2><p v-if="!game.players.length" class="rounded-panel border border-default bg-muted p-section text-muted">No players yet. Add someone to start creating characters.</p><div v-else class="grid gap-medium md:grid-cols-2"><button v-for="person in game.players" :key="person.id" class="rounded-panel border border-default p-large text-left hover:bg-elevated" @click="openPlayer(person)"><span class="font-semibold">{{ person.name }}</span><span class="block text-muted">{{ person.characters.find(entry => entry.id === person.activeCharacterId)?.identity.name ? `Active: ${person.characters.find(entry => entry.id === person.activeCharacterId)?.identity.name}` : "No active character" }}</span></button></div><form class="flex flex-wrap items-end gap-medium" @submit.prevent="addPlayer"><label class="font-medium">Player name<input v-model="playerName" class="mt-small block rounded-panel border border-default bg-default p-medium" /></label><UButton type="submit">Add player</UButton></form><p v-if="formError" role="alert" class="text-error">{{ formError }}</p></section>
      </template>
      <template v-else-if="screen === 'player'">
        <div class="flex flex-wrap items-end justify-between gap-large"><div><p class="text-muted">{{ game.name }} / Player</p><h1 ref="heading" tabindex="-1" class="text-heading font-semibold">{{ player.name }}</h1><p class="mt-small text-muted">Characters can be revisited at any time.</p></div><UButton v-if="game.system === 'Fabula Ultima'" @click="createCharacter">Create character</UButton></div><div v-if="!player.characters.length" class="rounded-panel border border-default bg-muted p-section text-muted">No characters yet. Create the first character for {{ player.name }}.</div><div v-else class="grid gap-medium"><div v-for="entry in player.characters" :key="entry.id" class="flex flex-wrap items-center justify-between gap-medium rounded-panel border border-default p-large"><button class="text-left" @click="openCharacter(entry)"><span class="font-semibold">{{ entry.identity.name || 'Unnamed character' }}</span><span class="block text-muted">View character →</span></button><span v-if="player.activeCharacterId === entry.id" class="text-muted">Active</span><UButton v-else size="sm" variant="outline" @click="player.activeCharacterId = entry.id">Set active</UButton></div></div>
      </template>
      <template v-else>
        
        <main class="sheet space-y-small rounded-panel border border-default bg-default p-medium" :class="{ 'is-locked': editingLocked }" @pointerdown.capture="warnIfEditingLocked">
          <header class="sheet-header border-b border-default pb-small">
            <fieldset :disabled="editingLocked" class="contents"><div class="name-field min-w-0"><p class="sheet-kicker">FABULA ULTIMA <span> / CHARACTER SHEET</span></p><h1 ref="heading" tabindex="-1" class="sr-only">Character sheet</h1><label class="sheet-name"><span class="sr-only">Character name</span><input v-model="identity.name" placeholder="Character name" /></label></div>
            <label class="sheet-field theme-field">✦ THEME<input v-model="identity.theme" placeholder="Hope, justice…" /></label><label class="level-mark"><span>LEVEL</span><input type="number" min="5" max="50" :value="level" aria-label="Character level" @change="setLevel" /><small>MANUAL</small></label></fieldset>
            <UButton data-testid="toggle-editing-lock" class="editing-lock" color="warning" variant="outline" :aria-pressed="editingLocked" @click="character.editingLocked = !editingLocked"><svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path v-if="editingLocked" d="M8 10V7a4 4 0 0 1 8 0v3"/><path v-else d="M8 10V7a4 4 0 0 1 7.5-2"/><path d="M12 14v3"/></svg>{{ editingLocked ? 'Unlock editing' : 'Lock editing' }}</UButton>
          </header>
          <fieldset :disabled="editingLocked" class="sheet-sections">
            <section class="sheet-panel" aria-label="Attributes and resources">
              <div class="sheet-split">
                <section class="sheet-subsection"><h2 class="sheet-heading">◈ ATTRIBUTES <span>BASE DICE</span></h2><div class="dice-grid"><div v-for="attribute in (['DEX', 'INS', 'MIG', 'WLP'] as const)" :key="attribute" class="die"><div class="stat-label"><span>{{ attribute }}</span><InfoTooltip :label="`About ${attribute}`" :text="attributeHelp[attribute]" /></div><div class="die-value"><DieIcon :sides="attributes[attribute]" /><select v-model="attributes[attribute]" :aria-label="attribute"><option value="6">d6</option><option value="8">d8</option><option value="10">d10</option></select></div></div></div></section>
                <section class="sheet-subsection"><h2 class="sheet-heading">✚ RESOURCES <span>CURRENT / MAX</span></h2><div class="resource-grid"><label v-for="resource in (['HP', 'MP', 'IP'] as const)" :key="resource" class="resource"><strong>{{ resource }}</strong><span class="resource-values"><input type="number" min="0" :aria-label="`Current ${resource}`" :value="current[resource] ?? maximum[resource]" @input="current[resource] = Number.isNaN(($event.target as HTMLInputElement).valueAsNumber) ? null : ($event.target as HTMLInputElement).valueAsNumber" /><span aria-hidden="true">/</span><span :aria-label="`Maximum ${resource}: ${maximum[resource]}`">{{ maximum[resource] }}</span></span></label><label class="resource fabula"><strong>FABULA</strong><input v-model.number="current.Fabula" type="number" min="0" aria-label="Fabula points" /></label></div></section>
              </div>
            </section>
            <section class="sheet-panel" aria-label="Classes and skills">
              <div class="sheet-split">
                <section class="sheet-subsection"><h2 class="sheet-heading">◆ CLASSES <span>UP TO 2</span></h2><NamedEntries :entries="classes" :locked="editingLocked" kind="class" :limit="2" /></section>
                <section class="sheet-subsection"><h2 class="sheet-heading"><div class="heading-label">◆ SKILLS <InfoTooltip label="About skills" text="Skills are class abilities. Their ranks and effects are not automated here." /></div></h2><NamedEntries :entries="skills" :locked="editingLocked" kind="skill" /><p class="sheet-note">Manual level; advancement and skill effects are not automated.</p></section>
              </div>
            </section>
            <section class="sheet-panel" aria-label="Equipment and defense">
              <div class="sheet-split">
                <section class="sheet-subsection"><h2 class="sheet-heading">◇ EQUIPMENT</h2><NamedEntries :entries="equipment" :locked="editingLocked" kind="item" price /><p class="sheet-note">Equipped armor and shield modify defense. Other effects are not calculated.</p></section>
                <section class="sheet-subsection"><h2 class="sheet-heading">⬡ DEFENSE <span>BASE / OVERRIDE</span></h2><div class="defense-grid"><div v-for="stat in (['DEF', 'MAG DEF', 'INIT'] as const)" :key="stat" class="defense-stat" :data-testid="`defense-card-${stat}`"><div class="stat-label"><span>{{ stat }}</span><InfoTooltip :label="`About ${stat}`" :text="defenseHelp[stat]" /></div><input type="number" :data-testid="`defense-${stat}`" :aria-label="stat" :value="overrides[stat] ?? baseDefense[stat]" @input="overrides[stat] = Number.isNaN(($event.target as HTMLInputElement).valueAsNumber) ? null : ($event.target as HTMLInputElement).valueAsNumber" /><ul class="defense-calculation" :aria-label="`${stat} calculated contributions`"><li v-for="(contribution, index) in defenseDetails[stat]" :key="index"><span>{{ contribution.name }}</span><span>{{ contribution.modifier && contribution.value > 0 ? "+" : "" }}{{ contribution.value }}</span></li></ul><span v-if="overrides[stat] !== null" class="override-label">Overridden</span><button v-if="overrides[stat] !== null" :data-testid="`restore-${stat}`" type="button" @click="overrides[stat] = null">Use calculated</button></div></div><p class="sheet-note">Skill and other effects are not included.</p></section>
              </div>
            </section>
          </fieldset>

        </main>
      </template>
        </div>
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
.prototype-layout { display: flex; flex-direction: column; gap: var(--spacing-medium); }
.prototype-content { min-width: 0; flex: 1; }
@media (min-width: 1024px) { .prototype-layout { flex-direction: row; align-items: stretch; } }
.sheet { --sheet-label-size: 0.75rem; --sheet-meta-size: 0.625rem; --sheet-tight: 0.25rem; border-color: var(--ui-border-accented); }
.sheet-kicker, .sheet-subtitle, .sheet-note, .sheet-field, .level-mark, .sheet-heading span, .die span, .resource strong, .defense-grid span { color: var(--ui-text-muted); }
.sheet-kicker, .sheet-heading, .sheet-field, .level-mark, .die span, .resource strong, .defense-grid span { font-size: var(--sheet-label-size); font-weight: 700; letter-spacing: 0.05em; }
.sheet-kicker { color: var(--ui-primary); }
.sheet-header { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto auto; gap: var(--spacing-small); align-items: stretch; }
.name-field, .theme-field { display: flex; flex-direction: column; justify-content: end; }
.sheet-name input, .theme-field input { display: block; width: 100%; min-width: 0; color: var(--ui-text-highlighted); background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); padding: var(--sheet-tight) var(--spacing-small); font-size: var(--text-body); line-height: 1.5rem; font-weight: 400; letter-spacing: normal; }
.sheet-name input::placeholder { color: var(--ui-text-muted); }
.sheet-subtitle, .sheet-note { font-size: var(--sheet-label-size); }
.level-mark { display: grid; text-align: center; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); padding: var(--spacing-small) var(--spacing-medium); line-height: 1; }
.level-mark input { width: 3.5rem; justify-self: center; appearance: textfield; text-align: center; color: var(--ui-text-highlighted); font-size: var(--text-body); line-height: normal; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); }
.level-mark input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.level-mark small { font-size: var(--sheet-meta-size); }
.is-locked fieldset :is(input, select, textarea, button) { pointer-events: none; }
.editing-lock { align-self: stretch; justify-content: center; }
.lock-icon { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.sheet-sections { display: grid; gap: var(--spacing-small); }
.sheet-split { display: grid; gap: var(--spacing-medium); }
.sheet-subsection { min-width: 0; }
@media (min-width: 640px) { .sheet-split { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sheet-panel { border: 1px solid var(--ui-border); border-radius: var(--radius-panel); padding: var(--spacing-small); min-width: 0; }
.sheet-heading { display: flex; justify-content: space-between; gap: var(--spacing-small); color: var(--ui-primary); margin-bottom: var(--sheet-tight); }
.sheet-heading span { text-align: right; font-weight: 500; }
.sheet-field { display: block; margin-top: var(--sheet-tight); }
.sheet-field:not(.theme-field) input, .sheet-field select, .sheet-field textarea { display: block; width: 100%; min-width: 0; color: var(--ui-text-highlighted); background: var(--ui-bg-muted); border: 1px solid var(--ui-border); border-radius: var(--radius-panel); padding: var(--sheet-tight) var(--spacing-small); font-size: var(--text-body); font-weight: 400; letter-spacing: normal; }
.sheet-field textarea { resize: vertical; }
.theme-field { display: flex; width: auto; margin: 0; }
.class-grid, .dice-grid, .resource-grid, .defense-grid { display: grid; gap: var(--spacing-small); }
.class-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dice-grid, .resource-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: var(--sheet-tight); }
.die, .resource, .defense-stat { min-width: 0; display: grid; text-align: center; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); padding: var(--sheet-tight) var(--spacing-small); }
.die-value { display: flex; align-items: center; justify-content: center; gap: 0; min-width: 0; }
.die-value :deep(.die-icon) { width: 1rem; height: 1rem; }
.die select { appearance: none; width: 100%; min-width: 0; text-align: center; cursor: pointer; color: var(--ui-text-highlighted); font-weight: 700; background: transparent; }
.resource span, .defense-grid strong { font-weight: 700; color: var(--ui-text-highlighted); }
.fabula span { color: var(--ui-primary); }
.defense-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.equipment-list li { display: flex; justify-content: space-between; gap: var(--spacing-small); border-bottom: 1px solid var(--ui-border); }
.item-add { display: flex; gap: var(--spacing-small); margin-top: var(--sheet-tight); }
.item-add input { min-width: 0; flex: 1; background: var(--ui-bg-muted); border: 1px solid var(--ui-border); border-radius: var(--radius-panel); padding: var(--sheet-tight) var(--spacing-small); }
.resource-values { width: 100%; display: grid; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg); grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: var(--sheet-tight); white-space: nowrap; }
.resource-values input { width: 100%; text-align: right; }
.resource-values span { color: var(--ui-text-muted); }
.resource-values span:last-child { text-align: left; }
.die-value::after { content: "⌄"; color: var(--ui-text-muted); }
.resource input, .defense-stat input { width: 4ch; min-width: 0; justify-self: center; appearance: textfield; text-align: center; background: var(--ui-bg); border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); color: var(--ui-text-highlighted); font-weight: 700; }
.resource .resource-values input { width: 100%; text-align: right; border: 0; background: transparent; outline: none; }
.resource-values:focus-within { outline: 2px solid var(--ui-primary); outline-offset: 1px; }
.resource input::-webkit-inner-spin-button, .defense-stat input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.heading-label { display: inline-flex; align-items: center; gap: 0.25rem; }
.stat-label { display: flex; justify-content: center; align-items: center; gap: 0.25rem; }
.defense-calculation { width: 100%; margin-top: var(--spacing-small); border-top: 1px solid var(--ui-border-accented); padding-top: var(--sheet-tight); }
.defense-calculation li { display: flex; justify-content: space-between; align-items: baseline; gap: 0.25rem; text-align: left; }
.defense-grid .defense-calculation span, .defense-grid .override-label { font-size: var(--sheet-meta-size); font-weight: 400; letter-spacing: normal; line-height: 1.35; overflow-wrap: anywhere; }
.defense-calculation li span:last-child { flex: none; color: var(--ui-text); font-variant-numeric: tabular-nums; }
.defense-stat > button { font-size: var(--sheet-meta-size); color: var(--ui-primary); }

.sheet-review { font-size: var(--text-body); color: var(--ui-text-muted); }
.sheet-review summary { cursor: pointer; color: var(--ui-text); font-weight: 600; }
.sheet-review ul { list-style: disc; padding-left: var(--spacing-section); }
@media (max-width: 640px) { .sheet-header { grid-template-columns: minmax(0, 1fr) auto; } .name-field, .theme-field { grid-column: 1 / -1; } }
@media (max-width: 420px) { .dice-grid, .resource-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
