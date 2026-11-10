<script setup lang="ts">
/** Presentation only; persistence and permissions are coordinated by useNpcTable. */
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import SheetSection from "../../src/shared/design-system/SheetSection.vue";
import ContentState from "../../src/shared/design-system/ContentState.vue";
import EdgeTabs from "../../src/shared/design-system/EdgeTabs.vue";
import PartyCharacterCard from "../../src/modules/game-table/PartyCharacterCard.vue";
import HistoryPanel from "../../src/modules/game-table/HistoryPanel.vue";
import RollDialog from "../../src/modules/game-table/RollDialog.vue";
import FreeRollDialog from "../../src/modules/game-table/FreeRollDialog.vue";
import CharacterSheet from "../../src/modules/characters/sheet/CharacterSheet.vue";
import NpcCard from "./NpcCard.vue";
import NpcSheet from "./NpcSheet.vue";
import TagEditor from "./TagEditor.vue";
import type { useNpcTable } from "./useNpcTable";
const props = defineProps<{ table: ReturnType<typeof useNpcTable> }>();
const state = props.table.state;
const tabs = [
  {
    id: "sheets",
    width: "wide" as const,
    label: "Character sheets",
    color: "primary" as const,
    testId: "edge-tab-sheets",
  },
  {
    id: "npcs",
    width: "wide" as const,
    label: "NPCs",
    color: "info" as const,
    testId: "edge-tab-npcs",
  },
  { id: "history", label: "Throw history", color: "warning" as const, testId: "edge-tab-history" },
];
</script>
<template>
  <UApp>
    <div class="min-h-screen bg-default text-default">
      <header
        class="flex items-center justify-between border-b border-default px-section py-medium"
      >
        <span class="text-section font-semibold">The Lantern Road</span>
        <UButton
          color="neutral"
          variant="outline"
          data-testid="open-settings"
          @click="state.settingsOpen = true"
          >Settings</UButton
        >
      </header>
      <main class="p-section">
        <p v-if="state.error" role="alert" data-testid="table-error">{{ state.error }}</p>
        <ScreenSection class="p-large">
          <div class="flex items-center justify-between gap-small">
            <h2 class="text-section font-semibold">Table</h2>
            <UButton
              v-if="state.role === 'GM'"
              data-testid="add-npc"
              @click="
                state.selectedNpcId = '__new__';
                state.edgeTab = 'npcs';
              "
              >+ Add NPC</UButton
            >
          </div>
          <ContentState v-if="state.loading || state.view === 'Loading'" kind="loading"
            >Loading table…</ContentState
          >
          <ContentState
            v-else-if="state.view === 'Error' || state.loadError"
            kind="error"
            retry-test-id="retry-table"
            @retry="table.reload()"
          />
          <ul
            v-else-if="state.view !== 'Empty'"
            class="grid items-stretch gap-small pt-medium sm:grid-cols-2"
            data-testid="table-cards"
          >
            <template v-if="state.view === 'Mixed' || state.view === 'Characters only'">
              <li
                v-for="member in state.party"
                :key="member.id"
                :data-testid="`party-${member.id}`"
              >
                <PartyCharacterCard
                  :member="{ ...member, canRoll: state.role === 'GM' || member.canRoll }"
                  :can-edit="state.role === 'GM'"
                  @roll-attribute="table.openAttributeRoll(member, $event)"
                  @roll-weapon="table.openWeaponRoll(member, $event)"
                  @needs-weapon-setup="table.openSheet(member.id)"
                  @edit="table.openSheet(member.id)"
                />
              </li>
            </template>
            <template v-if="state.view === 'Mixed' || state.view === 'NPCs only'">
              <li v-for="npc in state.npcs" :key="npc.id">
                <NpcCard
                  :npc="npc"
                  :can-roll="state.role === 'GM'"
                  :can-edit="state.role === 'GM'"
                  @edit="
                    state.selectedNpcId = npc.id;
                    state.edgeTab = 'npcs';
                  "
                  @roll-attribute="table.openNpcAttributeRoll"
                  @roll-attack="table.openAttackRoll"
                />
              </li>
            </template>
          </ul>
          <p v-else class="pt-medium text-muted" data-testid="table-empty">
            No characters or NPCs yet.
          </p>
        </ScreenSection>
      </main>
      <EdgeTabs v-model:open-id="state.edgeTab" :tabs="tabs">
        <template #sheets>
          <UButton
            data-testid="close-sheets"
            color="neutral"
            variant="ghost"
            @click="state.edgeTab = null"
            >Close sheets</UButton
          >
          <div class="flex gap-small" role="tablist" aria-label="Character sheets">
            <UButton
              v-for="member in state.party"
              :key="member.id"
              role="tab"
              :aria-selected="state.selectedSheetId === member.id"
              :data-testid="`sheet-tab-${member.id}`"
              :variant="state.selectedSheetId === member.id ? 'solid' : 'outline'"
              @click="table.selectSheet(member.id)"
              >{{ member.name }}</UButton
            >
          </div>
          <ContentState v-if="state.sheetLoading" kind="loading">Loading character…</ContentState>
          <template v-else-if="state.character">
            <CharacterSheet
              :key="state.selectedSheetId"
              :character="state.character"
              :read-only="state.role !== 'GM' || state.pending"
              :maximum="table.maximum.value"
              :maximum-overrides="state.maximumOverrides"
              :base-defense="table.baseDefense.value"
              :defense-details="{ DEF: [], 'MAG DEF': [], INIT: [] }"
              @override-maximum="table.overrideMaximum"
            />
            <section class="mt-small rounded-panel border border-default p-medium">
              <SheetSection
                ><template #heading>◉ TAGS</template><template #hint>PER GAME</template>
                <fieldset v-if="state.role === 'GM'" :disabled="state.pending">
                  <TagEditor
                    :tags="state.character.tags ?? []"
                    :saved-tags="state.savedTags"
                    @change="state.character.tags = $event"
                  />
                </fieldset>
                <p v-else data-testid="readonly-character-tags">
                  {{ state.character.tags?.map((tag) => tag.name).join(", ") }}
                </p>
              </SheetSection>
            </section>
            <p v-if="state.role === 'GM'" class="text-muted">
              Cards show the last saved character. Switching sheets asks before discarding unsaved
              changes.
            </p>
            <UButton
              v-if="state.role === 'GM'"
              :loading="state.pending"
              data-testid="save-character"
              @click="table.saveCharacter()"
              >Save character</UButton
            >
          </template>
        </template>
        <template #npcs>
          <UButton
            data-testid="close-npcs"
            color="neutral"
            variant="ghost"
            @click="state.edgeTab = null"
            >Close NPCs</UButton
          >
          <UButton
            v-if="state.role === 'GM'"
            data-testid="add-npc-sheet"
            @click="state.selectedNpcId = '__new__'"
            >+ Add NPC</UButton
          >
          <UTabs
            v-model="state.selectedNpcId"
            :items="[
              ...state.npcs.map((n) => ({ label: n.name, value: n.id })),
              ...(state.role === 'GM' ? [{ label: '+ New NPC', value: '__new__' }] : []),
            ]"
          />
          <NpcSheet
            v-if="state.selectedNpcId !== '__new__' || state.role === 'GM'"
            :key="state.selectedNpcId"
            :npc="state.npcs.find((n) => n.id === state.selectedNpcId) ?? null"
            :saved-tags="state.savedTags"
            :read-only="state.role !== 'GM'"
            :pending="state.pending"
            @save="table.saveNpc"
          />
        </template>
        <template #history>
          <HistoryPanel
            :throws="state.throws"
            :is-loading="state.loading"
            :is-error="state.loadError"
            :has-older="false"
            highlight-id=""
            class="border-0"
            @reroll="table.reroll"
            @remove="table.removeThrow"
            @make-roll="table.openFreeRoll()"
          />
        </template>
      </EdgeTabs>
      <RollDialog
        v-if="state.rollDraft"
        :draft="state.rollDraft"
        :opponent="state.rollOpponent"
        :error="state.error"
        :pending="state.pending"
        @update:opponent="state.rollOpponent = $event"
        @submit="table.submitRoll()"
        @cancel="state.rollDraft = null"
      />
      <FreeRollDialog
        v-if="state.freeDraft"
        :draft="state.freeDraft"
        :opponent="state.freeOpponent"
        :role="state.role"
        :roll-as-options="[
          { label: 'GM', value: 'gm' },
          ...state.party
            .filter((m) => state.role === 'GM' || m.canRoll)
            .map((m) => ({ label: m.name, value: m.id })),
        ]"
        :player-active-name="state.party.find((m) => m.canRoll)?.name ?? ''"
        :player-has-active="state.party.some((m) => m.canRoll)"
        :error="state.error"
        :pending="state.pending"
        @update:opponent="state.freeOpponent = $event"
        @update:character="state.freeDraft.characterId = $event"
        @submit="table.submitFreeRoll()"
        @cancel="state.freeDraft = null"
      />
      <UModal
        :open="state.settingsOpen"
        title="Settings"
        @update:open="state.settingsOpen = $event"
      >
        <template #body
          ><p class="text-muted">
            Game settings preview — navigation target only in this prototype.
          </p></template
        >
      </UModal>
    </div>
  </UApp>
</template>
