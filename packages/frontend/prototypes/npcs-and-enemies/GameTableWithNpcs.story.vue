<script setup lang="ts">
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import SheetSection from "../../src/shared/design-system/SheetSection.vue";
import ContentState from "../../src/shared/design-system/ContentState.vue";
import EdgeTabs from "../../src/shared/design-system/EdgeTabs.vue";
import PartyCharacterCard from "../../src/modules/game-table/PartyCharacterCard.vue";
import HistoryPanel from "../../src/modules/game-table/HistoryPanel.vue";
import RollDialog from "../../src/modules/game-table/RollDialog.vue";
import FreeRollDialog from "../../src/modules/game-table/FreeRollDialog.vue";
import CharacterSheet from "../../src/modules/characters/sheet/CharacterSheet.vue";
import type {
  Attribute,
  FreeDraft,
  OpponentDraft,
  PartyCharacter,
  RollDraft,
  ThrowRecord,
} from "../../src/modules/game-table/types";
import NpcCard from "./NpcCard.vue";
import NpcSheet from "./NpcSheet.vue";
import TagEditor from "./TagEditor.vue";
import { allNpcs } from "./fixtures";
import type { Npc } from "./fixtures";
import type { Tag } from "./tags";
import {
  partyMember,
  sword,
  makeCharacter,
  makeThrow,
  sheetMaximum,
  baseDefense,
  defenseDetails,
} from "../domain/fixtures";

const party: PartyCharacter[] = [
  {
    ...partyMember,
    weapons: [{ ...sword, ready: true }],
    tags: [
      { name: "Vanguard", color: "primary" },
      { name: "Iron Pass", color: "info" },
    ] as Tag[],
  },
  {
    ...partyMember,
    id: "nera",
    name: "Nera Vale",
    classes: ["Elementalist", "Orator"],
    resources: { hp: 16, mp: 32, ip: 3, fabula: 2 },
    canRoll: false,
    weapons: [],
    tags: [{ name: "Scholar", color: "warning" }] as Tag[],
  },
];

function initialState() {
  return {
    role: "GM" as "GM" | "Player",
    view: "Mixed" as "Mixed" | "Characters only" | "NPCs only" | "Empty" | "Loading" | "Error",
    npcs: structuredClone(allNpcs) as Npc[],
    savedTags: [
      ...new Map(allNpcs.flatMap((n) => n.tags).map((tag) => [tag.name, tag])).values(),
    ] as Tag[],
    selectedNpcId: "__new__" as string,
    rollDraft: null as RollDraft | null,
    rollOpponent: { dice: [], modifier: "0" } as OpponentDraft,
    freeDraft: null as FreeDraft | null,
    freeOpponent: { dice: [], modifier: "0" } as OpponentDraft,
    throws: [makeThrow("weapon-accuracy"), makeThrow("opposed-check")] as ThrowRecord[],
    selectedSheetId: party[0].id,
    edgeTab: null as string | null,
    character: {
      ...makeCharacter(),
      tags: [{ name: "Vanguard", color: "primary" }] as Tag[],
    },
    maximumOverrides: { HP: null, MP: null, IP: null } as Record<"HP" | "MP" | "IP", number | null>,
    settingsOpen: false,
  };
}

function mergeSavedTags(state: ReturnType<typeof initialState>, tags: readonly Tag[]) {
  for (const tag of tags) {
    if (!state.savedTags.some((saved) => saved.name === tag.name)) {
      state.savedTags.push({ ...tag });
    }
  }
}

function saveNpc(state: ReturnType<typeof initialState>, npc: Npc, newTags: Tag[]) {
  const index = state.npcs.findIndex((candidate) => candidate.id === npc.id);
  if (index >= 0) state.npcs[index] = npc;
  else state.npcs.push(npc);
  mergeSavedTags(state, newTags);
  state.selectedNpcId = npc.id;
}

function openAttributeRoll(
  state: ReturnType<typeof initialState>,
  name: string,
  baseDice: Record<Attribute, number>,
  attribute: Attribute,
) {
  state.rollDraft = {
    mode: "attribute",
    character: {
      id: name,
      revision: 1,
      name,
      classes: [],
      baseDice,
      resources: { hp: 0, mp: 0, ip: 0, fabula: 0 },
      maxima: { hp: 0, mp: 0, ip: 0 },
      defense: null,
      magicDefense: null,
      weapons: [],
      canRoll: true,
    },
    weaponId: null,
    weaponName: "",
    weaponBonus: 0,
    first: attribute,
    second: null,
    dice: { ...baseDice },
    modifier: "0",
    note: "",
  };
}

function openAttackRoll(
  state: ReturnType<typeof initialState>,
  npc: Npc,
  attack: Npc["attacks"][number],
) {
  state.rollDraft = {
    mode: "weapon",
    character: {
      id: npc.id,
      revision: 1,
      name: npc.name,
      classes: [],
      baseDice: npc.baseDice,
      resources: { hp: 0, mp: 0, ip: 0, fabula: 0 },
      maxima: { hp: 0, mp: 0, ip: 0 },
      defense: null,
      magicDefense: null,
      weapons: [],
      canRoll: true,
    },
    weaponId: attack.id,
    weaponName: attack.name,
    weaponBonus: Math.floor(npc.level / 10),
    first: attack.attributes[0] as Attribute,
    second: attack.attributes[1] as Attribute,
    dice: { ...npc.baseDice },
    modifier: "0",
    note: `high roll +${attack.damageBonus} ${attack.damageType}`,
  };
}

function openFreeRoll(state: ReturnType<typeof initialState>) {
  state.freeOpponent = { dice: [], modifier: "0" };
  state.freeDraft = { characterId: "gm", dice: [], modifier: "0", note: "" };
}
</script>

<template>
  <Story title="Prototypes/NPCs and enemies/Game table with NPCs" :init-state="initialState">
    <template #default="{ state }">
      <UApp>
        <div class="min-h-screen bg-default text-default">
          <header
            class="flex items-center justify-between border-b border-default px-section py-medium"
          >
            <span class="text-section font-semibold">The Lantern Road</span>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-settings"
              data-testid="open-settings"
              @click="state.settingsOpen = true"
            >
              Settings
            </UButton>
          </header>
          <main class="p-section">
            <div class="grid gap-section">
              <ScreenSection class="p-large">
                <div class="flex items-center justify-between gap-small">
                  <h2 class="text-section font-semibold">Table</h2>
                  <UButton
                    v-if="state.role === 'GM'"
                    color="primary"
                    variant="outline"
                    size="sm"
                    data-testid="add-npc"
                    @click="
                      state.selectedNpcId = '__new__';
                      state.edgeTab = 'npcs';
                    "
                  >
                    + Add NPC
                  </UButton>
                </div>
                <ContentState v-if="state.view === 'Loading'" kind="loading">
                  Loading table…
                </ContentState>
                <ContentState
                  v-else-if="state.view === 'Error'"
                  kind="error"
                  retry-test-id="retry-table"
                  @retry="state.view = 'Mixed'"
                />
                <ul
                  v-else-if="state.view !== 'Empty'"
                  class="grid items-stretch gap-small pt-medium sm:grid-cols-2"
                  data-testid="table-cards"
                >
                  <li
                    v-for="member in state.view === 'Mixed' || state.view === 'Characters only'
                      ? party
                      : []"
                    :key="`pc-${member.id}`"
                    class="h-full"
                  >
                    <PartyCharacterCard
                      class="h-full"
                      :member="{ ...member, canRoll: state.role === 'GM' || member.canRoll }"
                      :can-edit="state.role === 'GM'"
                      @roll-attribute="
                        openAttributeRoll(state, member.name, member.baseDice, $event)
                      "
                      @edit="
                        state.selectedSheetId = member.id;
                        state.edgeTab = 'sheets';
                      "
                    />
                  </li>
                  <li
                    v-for="npc in state.view === 'Mixed' || state.view === 'NPCs only'
                      ? state.npcs
                      : []"
                    :key="`npc-${npc.id}`"
                    class="h-full"
                  >
                    <NpcCard
                      :npc="npc"
                      :can-roll="state.role === 'GM'"
                      :can-edit="state.role === 'GM'"
                      @edit="
                        state.selectedNpcId = npc.id;
                        state.edgeTab = 'npcs';
                      "
                      @roll-attribute="
                        (n, attr) => openAttributeRoll(state, n.name, n.baseDice, attr)
                      "
                      @roll-attack="(n, attack) => openAttackRoll(state, n, attack)"
                    />
                  </li>
                </ul>
                <p v-else class="pt-medium text-muted" data-testid="table-empty">
                  No characters or NPCs yet.
                </p>
              </ScreenSection>
            </div>
          </main>
          <EdgeTabs
            v-model:open-id="state.edgeTab"
            :tabs="[
              {
                id: 'sheets',
                width: 'wide',
                label: 'Character sheets',
                color: 'primary',
                testId: 'edge-tab-sheets',
              },
              {
                id: 'npcs',
                width: 'wide',
                label: 'NPCs',
                color: 'info',
                testId: 'edge-tab-npcs',
              },
              {
                id: 'history',
                label: 'Throw history',
                color: 'warning',
                testId: 'edge-tab-history',
              },
            ]"
          >
            <template #sheets>
              <UTabs
                v-model="state.selectedSheetId"
                :items="party.map((m) => ({ label: m.name, value: m.id }))"
              >
                <template #content>
                  <CharacterSheet
                    :character="state.character"
                    controller="Nera"
                    :read-only="state.role !== 'GM'"
                    :maximum="sheetMaximum"
                    :maximum-overrides="state.maximumOverrides"
                    :base-defense="baseDefense"
                    :defense-details="defenseDetails"
                    @override-maximum="
                      (resource, value) => (state.maximumOverrides[resource] = value)
                    "
                  />
                  <section
                    class="mt-small rounded-panel border border-default bg-default p-medium"
                    aria-label="Character tags"
                  >
                    <SheetSection
                      ><template #heading>◉ TAGS</template><template #hint>PER GAME</template>
                      <TagEditor
                        :tags="state.character.tags ?? []"
                        :saved-tags="state.savedTags"
                        @change="
                          (tags: Tag[]) => {
                            state.character.tags = tags;
                            mergeSavedTags(state, tags);
                          }
                        "
                      />
                    </SheetSection>
                  </section>
                </template>
              </UTabs>
            </template>
            <template #npcs>
              <div class="space-y-medium">
                <div class="flex justify-end">
                  <UButton
                    v-if="state.role === 'GM'"
                    color="primary"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-plus"
                    data-testid="add-npc-sheet"
                    @click="state.selectedNpcId = '__new__'"
                  >
                    + Add NPC
                  </UButton>
                </div>
                <UTabs
                  v-model="state.selectedNpcId"
                  :items="[
                    ...state.npcs.map((npc) => ({ label: npc.name, value: npc.id })),
                    { label: '+ New NPC', value: '__new__' },
                  ]"
                >
                  <template #content="{ item }">
                    <NpcSheet
                      :key="item.value"
                      :npc="
                        item.value === '__new__'
                          ? null
                          : (state.npcs.find((npc) => npc.id === item.value) ?? null)
                      "
                      :saved-tags="state.savedTags"
                      @save="(npc: Npc, newTags: Tag[]) => saveNpc(state, npc, newTags)"
                    />
                  </template>
                </UTabs>
              </div>
            </template>
            <template #history>
              <HistoryPanel
                :throws="state.throws"
                :is-loading="false"
                :is-error="false"
                :has-older="false"
                highlight-id=""
                class="border-0"
                @reroll="state.rollDraft = null"
                @remove="(entry) => (state.throws = state.throws.filter((t) => t.id !== entry.id))"
                @make-roll="openFreeRoll(state)"
              />
            </template>
          </EdgeTabs>
          <RollDialog
            v-if="state.rollDraft"
            :draft="state.rollDraft"
            :opponent="state.rollOpponent"
            error=""
            :pending="false"
            @update:opponent="state.rollOpponent = $event"
            @submit="state.rollDraft = null"
            @cancel="state.rollDraft = null"
          />
          <FreeRollDialog
            v-if="state.freeDraft"
            :draft="state.freeDraft"
            :opponent="state.freeOpponent"
            role="GM"
            :roll-as-options="[
              { label: 'GM', value: 'gm' },
              ...party.map((m) => ({ label: m.name, value: m.id })),
            ]"
            player-active-name=""
            :player-has-active="false"
            error=""
            :pending="false"
            @update:opponent="state.freeOpponent = $event"
            @update:character="state.freeDraft.characterId = $event"
            @submit="state.freeDraft = null"
            @cancel="state.freeDraft = null"
          />
          <UModal
            :open="state.settingsOpen"
            title="Settings"
            @update:open="(v: boolean) => (state.settingsOpen = v)"
          >
            <template #body>
              <p class="text-muted">
                Game settings preview — navigation target only in this prototype.
              </p>
            </template>
          </UModal>
        </div>
      </UApp>
    </template>
    <template #controls="{ state }">
      <HstSelect v-model="state.role" title="View as" :options="['GM', 'Player']" />
      <HstSelect
        v-model="state.view"
        title="Table contents"
        :options="['Mixed', 'Characters only', 'NPCs only', 'Empty', 'Loading', 'Error']"
      />
    </template>
  </Story>
</template>
