<script setup lang="ts">
import { computed, ref } from "vue";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import PartyCharacterCard from "../game-table/PartyCharacterCard.vue";
import CharacterSheetsDrawer from "../game-table/CharacterSheetsDrawer.vue";
import ProgressionSheet from "./ProgressionSheet.vue";
import TableClassesCard from "./TableClassesCard.vue";
import type { ProgressionSnapshot } from "./types";
const props = defineProps<{
  snapshot: ProgressionSnapshot;
  readOnly?: boolean;
  levels?: Record<string, number>;
  saving?: boolean;
}>();
defineEmits<{
  changeClass: [id: string, delta: number];
  changeSkill: [id: string, delta: number];
}>();
const selectedId = defineModel<string>("selectedId", { required: true });
const surface = ref("sheet");
const drawerOpen = ref(false);
const selected = computed(() =>
  props.snapshot.characters.find((entry) => entry.id === selectedId.value),
);
const characterTabs = computed(() =>
  props.snapshot.characters.map((entry) => ({ label: entry.sheet.name, value: entry.id })),
);
</script>
<template>
  <section class="space-y-medium">
    <UTabs
      v-model="surface"
      :items="[
        { label: 'Character sheet', value: 'sheet' },
        { label: 'Game table', value: 'table' },
      ]"
      :content="false"
    >
      <template #default="{ item }"
        ><span :data-testid="`surface-${item.value}`">{{ item.label }}</span></template
      >
    </UTabs>
    <template v-if="surface === 'sheet'">
      <LabeledSelect
        v-model="selectedId"
        label="Character"
        :items="characterTabs"
        data-testid="progression-character"
      >
        <template #item-label="{ item }"
          ><span :data-testid="`select-${item.value}`">{{ item.label }}</span></template
        >
      </LabeledSelect>
      <ProgressionSheet
        v-if="selected"
        :character="selected"
        :catalog="snapshot.catalog"
        :read-only="readOnly"
        :levels="levels"
        :saving="saving"
        @change-class="(id, delta) => $emit('changeClass', id, delta)"
        @change-skill="(id, delta) => $emit('changeSkill', id, delta)"
      />
    </template>
    <template v-else>
      <p class="text-small text-muted">
        Party-card preview. Rolling is disabled here; class management opens the same character
        sheet.
      </p>
      <ul class="grid gap-medium md:grid-cols-2">
        <PartyCharacterCard
          v-for="character in snapshot.characters"
          :key="character.id"
          :member="character.party"
        >
          <template #class-progression>
            <TableClassesCard :catalog="snapshot.catalog" :character="character" />
          </template>
          <template #actions>
            <UButton
              class="mt-medium"
              color="neutral"
              variant="outline"
              :data-testid="`open-sheet-${character.id}`"
              @click="
                selectedId = character.id;
                drawerOpen = true;
              "
              >Open character sheet</UButton
            >
          </template>
        </PartyCharacterCard>
      </ul>
      <CharacterSheetsDrawer
        v-model:open="drawerOpen"
        v-model:selected-id="selectedId"
        :tabs="characterTabs"
        :show-bookmark="false"
      >
        <template #sheet>
          <ProgressionSheet
            v-if="selected"
            :character="selected"
            :catalog="snapshot.catalog"
            :read-only="readOnly"
            :levels="levels"
            :saving="saving"
            @change-class="(id, delta) => $emit('changeClass', id, delta)"
            @change-skill="(id, delta) => $emit('changeSkill', id, delta)"
          />
        </template>
      </CharacterSheetsDrawer>
    </template>
  </section>
</template>
