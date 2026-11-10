<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SheetSection from "../../src/shared/design-system/SheetSection.vue";
import TagEditor from "./TagEditor.vue";
import type { Tag } from "./tags";
import type { Npc, NpcRank } from "./fixtures";

const props = defineProps<{
  npc: Npc | null;
  savedTags: readonly Tag[];
}>();
const emit = defineEmits<{ save: [npc: Npc, newTags: Tag[]] }>();

const ranks: NpcRank[] = ["Soldier", "Elite", "Champion"];

const form = ref<Partial<Npc>>({});
watch(
  () => props.npc,
  (npc) => {
    form.value = npc ? structuredClone(npc) : { tags: [], attacks: [], abilities: [] };
  },
  { immediate: true },
);

const isValid = computed(() => Boolean(form.value.name?.trim()));

function save() {
  if (!isValid.value) return;
  const base: Npc = props.npc ?? {
    id: `npc-${Date.now()}`,
    name: "",
    level: 5,
    rank: "Soldier",
    baseDice: { DEX: 8, INS: 8, MIG: 8, WLP: 8 },
    hp: { current: 0, max: 0 },
    mp: { current: 0, max: 0 },
    crisis: 0,
    defense: 0,
    magicDefense: 0,
    initiative: 0,
    attacks: [],
    abilities: [],
    vulnerabilities: [],
    resistances: [],
    immunities: [],
    statusImmunities: [],
    notes: "",
    tags: [],
  };
  const saved = { ...base, ...structuredClone(form.value), name: form.value.name!.trim() } as Npc;
  const newTags = (saved.tags ?? []).filter(
    (tag) => !props.savedTags.some((savedTag) => savedTag.name === tag.name),
  );
  emit("save", saved, newTags);
}
</script>

<template>
  <main
    class="sheet space-y-small rounded-panel border border-default bg-default p-medium"
    data-testid="npc-sheet"
  >
    <header class="sheet-header border-b border-default pb-small">
      <div class="name-field min-w-0">
        <p class="sheet-kicker">FABULA ULTIMA <span> / NPC SHEET</span></p>
        <label class="sheet-name min-w-0"
          ><span class="sr-only">NPC name</span
          ><input v-model="form.name" placeholder="NPC name" data-testid="npc-name"
        /></label>
      </div>
      <div class="level-mark" aria-label="NPC level">
        <span>LEVEL</span>
        <strong>{{ form.level ?? 5 }}</strong>
      </div>
    </header>

    <div class="sheet-sections">
      <section class="sheet-panel" aria-label="Rank">
        <SheetSection
          ><template #heading>◈ RANK</template><template #hint>SOLDIER / ELITE / CHAMPION</template>
          <label class="select-field rank-field"
            >RANK
            <select v-model="form.rank" aria-label="NPC rank">
              <option v-for="rank in ranks" :key="rank" :value="rank">{{ rank }}</option>
            </select></label
          >
        </SheetSection>
      </section>

      <section class="sheet-panel sheet-split" aria-label="Tags and notes">
        <SheetSection
          ><template #heading>◉ TAGS</template><template #hint>PER GAME</template>
          <TagEditor
            :tags="form.tags ?? []"
            :saved-tags="savedTags"
            @change="(tags) => (form.tags = tags)"
          />
        </SheetSection>
        <SheetSection
          ><template #heading>✎ NOTES</template><template #hint>GM ONLY</template>
          <textarea
            v-model="form.notes"
            class="text-field notes"
            rows="3"
            placeholder="Behavior, loot, scene notes…"
            aria-label="NPC notes"
          ></textarea>
        </SheetSection>
      </section>
    </div>

    <div class="flex justify-end border-t border-default pt-small">
      <UButton color="primary" :disabled="!isValid" data-testid="save-npc" @click="save">
        Save NPC
      </UButton>
    </div>
  </main>
</template>

<style scoped>
.sheet {
  --sheet-label-size: 0.75rem;
  --sheet-tight: 0.25rem;
  border-color: var(--ui-border-accented);
}
.sheet-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--spacing-small);
  align-items: stretch;
}
.sheet-kicker {
  color: var(--ui-primary);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.name-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: end;
}
.sheet-name input,
.text-field,
.select-field select {
  display: block;
  width: 100%;
  min-width: 0;
  color: var(--ui-text-highlighted);
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--sheet-tight) var(--spacing-small);
  font-size: var(--text-body);
  line-height: 1.5rem;
}
.sheet-name input::placeholder,
.text-field::placeholder {
  color: var(--ui-text-muted);
}
.level-mark {
  display: grid;
  text-align: center;
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
  padding: var(--spacing-small) var(--spacing-medium);
  line-height: 1;
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.level-mark strong {
  color: var(--ui-text-highlighted);
  font-size: var(--text-body);
}
.sheet-sections {
  display: grid;
  gap: var(--spacing-small);
}
.sheet-panel {
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  padding: var(--spacing-small);
  min-width: 0;
}
.sheet-split {
  display: grid;
  gap: var(--spacing-medium);
}
.rank-field {
  margin-top: var(--sheet-tight);
  max-width: 16rem;
}
.select-field {
  display: grid;
  gap: var(--sheet-tight);
  color: var(--ui-text-muted);
  font-size: var(--sheet-label-size);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.select-field select {
  color: var(--ui-text-highlighted);
  font-weight: 400;
  letter-spacing: normal;
}
.text-field {
  margin-top: var(--sheet-tight);
}
.notes {
  resize: vertical;
}
@media (min-width: 640px) {
  .sheet-split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
