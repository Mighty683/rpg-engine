<script setup lang="ts">
/** NPC layout extension of the production table and character controllers. */
import ScreenSection from "../../src/shared/design-system/ScreenSection.vue";
import SheetSection from "../../src/shared/design-system/SheetSection.vue";
import ContentState from "../../src/shared/design-system/ContentState.vue";
import EdgeTabs from "../../src/shared/design-system/EdgeTabs.vue";
import GameTable from "../../src/modules/game-table/GameTable.vue";
import CharacterSheetTabs from "../../src/modules/game-table/CharacterSheetTabs.vue";
import CharacterView from "../../src/modules/characters/CharacterView.vue";
import PartyCharacterCard from "../../src/modules/game-table/PartyCharacterCard.vue";
import HistoryPanel from "../../src/modules/game-table/HistoryPanel.vue";
import NpcCard from "./NpcCard.vue";
import NpcSheet from "./NpcSheet.vue";
import TagEditor from "./TagEditor.vue";
import type { Npc } from "./fixtures";
import type { Attribute, FreeDraft } from "../../src/modules/game-table/types";
import type { useNpcTable } from "./useNpcTable";
const props = defineProps<{ table: ReturnType<typeof useNpcTable>; gameId: string }>();
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
function npcRoll(
  npc: Npc,
  attributes: Attribute[],
  open: (draft: FreeDraft) => void,
  attack?: Npc["attacks"][number],
) {
  if (state.role !== "GM") return;
  open({
    characterId: "gm",
    dice: attributes.map((attribute) => npc.baseDice[attribute]),
    modifier: String(attack ? Math.floor(npc.level / 10) : 0),
    note: `${npc.name}${attack ? ` — ${attack.name}: high roll +${attack.damageBonus} ${attack.damageType}` : ""}`,
  });
}
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
      <p v-if="state.error" role="alert" data-testid="table-error">{{ state.error }}</p>
      <GameTable :game-id="gameId" :role="state.role" :throws-hint="0" class="!block">
        <template #layout="controller">
          <main class="p-section">
            <ScreenSection class="p-large">
              <h2 class="text-section font-semibold">Table</h2>
              <ContentState
                v-if="
                  state.loading || controller.partyQuery.isLoading.value || state.view === 'Loading'
                "
                kind="loading"
                >Loading table…</ContentState
              >
              <ContentState
                v-else-if="
                  state.view === 'Error' || state.loadError || controller.partyQuery.isError.value
                "
                kind="error"
                retry-test-id="retry-table"
                @retry="
                  table.reload();
                  controller.partyQuery.refetch();
                "
              />
              <ul
                v-else-if="state.view !== 'Empty'"
                class="grid items-stretch gap-small pt-medium sm:grid-cols-2"
                data-testid="table-cards"
              >
                <template v-if="state.view === 'Mixed' || state.view === 'Characters only'">
                  <li
                    v-for="member in controller.party"
                    :key="member.id"
                    :data-testid="`party-${member.id}`"
                  >
                    <PartyCharacterCard
                      :member="member"
                      :can-edit="state.role === 'GM'"
                      @roll-attribute="controller.openAttributeRoll(member, $event)"
                      @roll-weapon="controller.openWeaponRoll(member, $event)"
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
                      @roll-attribute="
                        (record, attribute) =>
                          npcRoll(record, [attribute], controller.openCustomFreeRoll)
                      "
                      @roll-attack="
                        (record, attack) =>
                          npcRoll(
                            record,
                            attack.attributes as Attribute[],
                            controller.openCustomFreeRoll,
                            attack,
                          )
                      "
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
              <CharacterSheetTabs
                v-model:selected-id="state.selectedSheetId"
                :tabs="controller.party.map((member) => ({ label: member.name, value: member.id }))"
              >
                <template #sheet="{ characterId }">
                  <CharacterView
                    :key="characterId"
                    :game-id="gameId"
                    :character-id="characterId"
                    :read-only="state.role !== 'GM'"
                  />
                  <section class="mt-small rounded-panel border border-default p-medium">
                    <SheetSection>
                      <template #heading>◉ TAGS</template><template #hint>PER GAME</template>
                      <fieldset v-if="state.role === 'GM'" :disabled="state.pending">
                        <TagEditor
                          :tags="
                            controller.party.find((member) => member.id === characterId)?.tags ?? []
                          "
                          :saved-tags="state.savedTags"
                          @change="table.saveCharacterTags(characterId, $event)"
                        />
                      </fieldset>
                      <p v-else data-testid="readonly-character-tags">
                        {{
                          controller.party
                            .find((member) => member.id === characterId)
                            ?.tags?.map((tag) => tag.name)
                            .join(", ")
                        }}
                      </p>
                    </SheetSection>
                  </section>
                </template>
              </CharacterSheetTabs>
            </template>
            <template #npcs>
              <UTabs
                v-model="state.selectedNpcId"
                :items="[
                  ...state.npcs.map((npc) => ({ label: npc.name, value: npc.id })),
                  ...(state.role === 'GM' ? [{ label: '+ New NPC', value: '__new__' }] : []),
                ]"
              />
              <NpcSheet
                v-if="state.selectedNpcId !== '__new__' || state.role === 'GM'"
                :key="state.selectedNpcId"
                :npc="state.npcs.find((npc) => npc.id === state.selectedNpcId) ?? null"
                :saved-tags="state.savedTags"
                :read-only="state.role !== 'GM'"
                :pending="state.pending"
                @save="table.saveNpc"
              />
            </template>
            <template #history>
              <HistoryPanel
                :throws="controller.history.throws.value"
                :is-loading="controller.history.isLoading.value"
                :is-error="controller.history.isError.value"
                :has-older="controller.history.hasOlder.value"
                :highlight-id="controller.highlightId"
                class="border-0"
                @reroll="controller.reroll"
                @remove="controller.removeEntry"
                @load-older="controller.history.loadOlder"
                @retry="controller.history.refresh"
                @make-roll="controller.openFreeRoll"
              />
            </template>
          </EdgeTabs>
        </template>
      </GameTable>
      <UModal v-model:open="state.settingsOpen" title="Settings"
        ><template #body
          ><p class="text-muted">
            Game settings preview — navigation target only in this prototype.
          </p></template
        ></UModal
      >
    </div>
  </UApp>
</template>
