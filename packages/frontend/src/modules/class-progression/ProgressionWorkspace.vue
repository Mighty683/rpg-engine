<script setup lang="ts">
import { computed, ref } from "vue";
import LabeledSelect from "../../shared/design-system/base/LabeledSelect.vue";
import PartyCharacterCard from "../game-table/PartyCharacterCard.vue";
import CharacterSheetsDrawer from "../game-table/CharacterSheetsDrawer.vue";
import ProgressionSheet from "./ProgressionSheet.vue";
import TableClassesCard from "./TableClassesCard.vue";
import type { ProgressionExperience, ProgressionSnapshot } from "./types";
const props = defineProps<{
  snapshot: ProgressionSnapshot;
  playerCharacterId?: string;
  readOnly?: boolean;
  levels?: Record<string, number>;
  saving?: boolean;
}>();
defineEmits<{
  changeClass: [id: string, delta: number];
  changeSkill: [id: string, delta: number];
  changeExperience: [field: keyof ProgressionExperience, value: number];
  changeLevel: [level: number];
}>();
const selectedId = defineModel<string>("selectedId", { required: true });
const surface = ref(props.playerCharacterId ? "table" : "sheet");
const drawerOpen = ref(false);
const sheetsById = computed(
  () => new Map(props.snapshot.characters.map((entry) => [entry.id, entry])),
);
const selected = computed(() => sheetsById.value.get(selectedId.value));
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
        v-if="!playerCharacterId || characterTabs.length > 1"
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
        @change-experience="(field, value) => $emit('changeExperience', field, value)"
        @change-level="$emit('changeLevel', $event)"
      />
    </template>
    <template v-else>
      <p v-if="!playerCharacterId" class="text-small text-muted">
        Party-card preview. Rolling is disabled here; class management opens the same character
        sheet.
      </p>
      <ul class="grid gap-medium md:grid-cols-2">
        <PartyCharacterCard v-for="member in snapshot.party" :key="member.id" :member="member">
          <template v-if="sheetsById.has(member.id)" #class-progression>
            <TableClassesCard :catalog="snapshot.catalog" :character="sheetsById.get(member.id)!" />
          </template>
          <template #actions>
            <UButton
              v-if="sheetsById.has(member.id)"
              class="mt-medium"
              color="neutral"
              variant="outline"
              :data-testid="`open-sheet-${member.id}`"
              @click="
                selectedId = member.id;
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
            @change-experience="(field, value) => $emit('changeExperience', field, value)"
            @change-level="$emit('changeLevel', $event)"
          />
        </template>
      </CharacterSheetsDrawer>
    </template>
  </section>
</template>
