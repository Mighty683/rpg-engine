<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import SheetSection from "../../shared/design-system/SheetSection.vue";
import AttributeField from "../characters/sheet/attributes/AttributeField.vue";
import ResourceField from "../characters/sheet/resources/ResourceField.vue";
import DefenseField from "../characters/sheet/defense/DefenseField.vue";
import CharacterLevelField from "../characters/sheet/identity/CharacterLevelField.vue";
import NpcAttacksEditor from "./NpcAttacksEditor.vue";
import type { Tag } from "./tags";
import type { Npc, NpcRelationship } from "./types";

const props = defineProps<{
  npc: Npc | null;
  readOnly?: boolean;
  pending?: boolean;
  resetToken?: number;
}>();
const emit = defineEmits<{ save: [npc: Npc, newTags: Tag[]]; remove: [id: string] }>();

const relationships: NpcRelationship[] = ["enemy", "neutral", "friend"];
const confirmingRemoval = ref(false);
const attributes = ["DEX", "INS", "MIG", "WLP"] as const;
const attributeHelp = {
  DEX: "Dexterity measures agility and is the usual base for Defense.",
  INS: "Insight measures awareness and is the base for Magic Defense.",
  MIG: "Might measures physical strength and contributes to maximum HP.",
  WLP: "Willpower measures resolve and contributes to maximum MP.",
};

function newNpc(): Npc {
  return {
    id: `npc-${crypto.randomUUID()}`,
    name: "",
    relationship: "neutral",
    level: 5,
    visibility: "hidden",
    baseDice: { DEX: 8, INS: 8, MIG: 8, WLP: 8 },
    hp: { current: 50, max: 50 },
    mp: { current: 45, max: 45 },
    crisis: 25,
    defense: 8,
    magicDefense: 8,
    initiative: 8,
    attacks: [],
    abilities: [],
    vulnerabilities: [],
    resistances: [],
    immunities: [],
    statusImmunities: [],
    notes: "",
    tags: [],
  };
}
const form = ref<Npc>(newNpc());
watch(
  () => props.npc?.id,
  () => {
    form.value = props.npc ? (JSON.parse(JSON.stringify(props.npc)) as Npc) : newNpc();
    form.value.visibility ??= "known";
    form.value.relationship ??= "neutral";
    confirmingRemoval.value = false;
  },
  { immediate: true },
);

const isValid = computed(
  () =>
    Boolean(form.value.name.trim()) &&
    Number.isInteger(form.value.level) &&
    form.value.level >= 5 &&
    form.value.level <= 60 &&
    [
      form.value.hp.current,
      form.value.hp.max,
      form.value.mp.current,
      form.value.mp.max,
      form.value.defense,
      form.value.magicDefense,
    ].every((value) => Number.isInteger(value) && value >= 0) &&
    form.value.hp.current <= form.value.hp.max &&
    form.value.mp.current <= form.value.mp.max &&
    form.value.attacks.every(
      (attack) => Boolean(attack.name.trim()) && Number.isInteger(attack.damageBonus),
    ),
);

function save() {
  if (!isValid.value || props.readOnly || props.pending) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const saved = {
    ...(JSON.parse(JSON.stringify(form.value)) as Npc),
    name: form.value.name.trim(),
  };
  emit("save", saved, []);
}
function removeNpc(id: string) {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  emit("remove", id);
}
let resetting = false;
watch(
  () => props.resetToken,
  () => {
    if (!props.npc) return;
    resetting = true;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    form.value = JSON.parse(JSON.stringify(props.npc)) as Npc;
    resetting = false;
  },
  { flush: "sync" },
);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  form,
  () => {
    clearTimeout(saveTimer);
    if (!resetting && props.npc && isValid.value && !props.readOnly)
      saveTimer = setTimeout(save, 400);
  },
  { deep: true, flush: "sync" },
);
onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    save();
  }
});
</script>

<template>
  <main
    class="sheet space-y-small rounded-panel border border-default bg-default p-medium"
    data-testid="npc-sheet"
  >
    <fieldset :disabled="readOnly || pending" class="contents">
      <header class="sheet-header border-b border-default pb-small">
        <div class="name-field min-w-0">
          <p class="sheet-kicker">FABULA ULTIMA <span> / NPC SHEET</span></p>
          <label class="sheet-name min-w-0"
            ><span class="sr-only">NPC name</span
            ><input v-model="form.name" placeholder="NPC name" data-testid="npc-name"
          /></label>
          <fieldset class="relationship" aria-label="NPC relationship">
            <label
              v-for="relationship in relationships"
              :key="relationship"
              :data-relationship="relationship"
            >
              <input
                v-model="form.relationship"
                type="radio"
                :value="relationship"
                :data-testid="`npc-relationship-${relationship}`"
              />
              <span>{{ relationship }}</span>
            </label>
          </fieldset>
          <fieldset
            v-if="!readOnly"
            class="relationship"
            aria-label="Player visibility"
            data-testid="npc-visibility"
          >
            <label v-for="visibility in ['hidden', 'visible', 'known']" :key="visibility">
              <input
                v-model="form.visibility"
                type="radio"
                :value="visibility"
                :data-testid="`npc-visibility-${visibility}`"
              />
              <span>{{ visibility }}</span>
            </label>
          </fieldset>
        </div>
        <CharacterLevelField
          :level="form.level"
          :max="60"
          label="NPC level"
          test-id="npc-level"
          @change="form.level = ($event.target as HTMLInputElement).valueAsNumber"
        />
        <div class="vital-resources">
          <ResourceField
            v-for="resource in ['hp', 'mp'] as const"
            :key="resource"
            :model-value="form[resource].current"
            :label="resource.toUpperCase()"
            :maximum="form[resource].max"
            :maximum-override="form[resource].max"
            :allow-calculated="false"
            :disabled="readOnly || pending"
            bar
            @update:model-value="
              (value) => {
                if (value !== null) form[resource].current = value;
              }
            "
            @override="
              (value) => {
                if (value !== null) form[resource].max = value;
              }
            "
          />
        </div>
      </header>

      <div class="sheet-sections">
        <section class="sheet-panel" aria-label="Attributes">
          <SheetSection
            ><template #heading>◈ ATTRIBUTES</template><template #hint>BASE DICE</template>
            <div class="stat-grid">
              <AttributeField
                v-for="attribute in attributes"
                :key="attribute"
                :model-value="String(form.baseDice[attribute])"
                :label="attribute"
                :help="attributeHelp[attribute]"
                :disabled="readOnly || pending"
                @update:model-value="form.baseDice[attribute] = Number($event)"
              />
            </div>
          </SheetSection>
        </section>
        <section class="sheet-panel" aria-label="Defenses">
          <SheetSection>
            <template #heading>◈ DEFENSES</template><template #hint>EDIT VALUES MANUALLY</template>
            <div class="defense-grid">
              <DefenseField
                v-for="stat in ['defense', 'magicDefense'] as const"
                :key="stat"
                :model-value="form[stat]"
                :label="{ defense: 'DEF', magicDefense: 'MAG DEF' }[stat]"
                :help="
                  {
                    defense: 'Defense against physical attacks.',
                    magicDefense: 'Defense against magical attacks.',
                  }[stat]
                "
                :calculated="null"
                :contributions="[]"
                manual
                compact
                @update:model-value="
                  (value) => {
                    if (value !== null) form[stat] = value;
                  }
                "
              />
            </div>
            <p v-if="!isValid" class="text-label text-muted">
              Enter a name, level 5–60 and valid non-negative stats. Current HP and MP cannot exceed
              their maximum. Attacks require a name and a whole-number damage bonus.
            </p>
          </SheetSection>
        </section>
        <section class="sheet-panel" aria-label="Attacks">
          <NpcAttacksEditor :attacks="form.attacks" />
        </section>
        <section v-if="!readOnly" class="sheet-panel" aria-label="Notes">
          <SheetSection
            ><template #heading>✎ NOTES</template><template #hint>GM ONLY</template>
            <textarea
              v-model="form.notes"
              class="text-field notes"
              rows="3"
              placeholder="Behavior, loot, scene notes…"
              aria-label="NPC notes"
              data-testid="npc-notes-field"
            ></textarea>
          </SheetSection>
        </section>
      </div>

      <div
        class="flex flex-wrap items-center justify-end gap-small border-t border-default pt-small"
      >
        <template v-if="!readOnly && npc">
          <UButton
            v-if="!confirmingRemoval"
            color="error"
            variant="outline"
            data-testid="remove-npc"
            @click="confirmingRemoval = true"
            >Remove NPC</UButton
          >
          <template v-else>
            <span>Remove {{ npc.name }}?</span>
            <UButton
              color="neutral"
              variant="outline"
              data-testid="cancel-remove-npc"
              @click="confirmingRemoval = false"
              >Cancel</UButton
            >
            <UButton color="error" data-testid="confirm-remove-npc" @click="removeNpc(npc.id)"
              >Confirm removal</UButton
            >
          </template>
        </template>
      </div>
    </fieldset>
  </main>
</template>

<style scoped>
.vital-resources {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-small);
}
@media (max-width: 640px) {
  .vital-resources {
    grid-template-columns: 1fr;
  }
}
.sheet {
  --sheet-label-size: 0.75rem;
  --sheet-meta-size: 0.625rem;
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
.relationship {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-small);
  margin-top: var(--sheet-tight);
  font-size: var(--sheet-label-size);
  text-transform: capitalize;
}
.relationship label {
  display: flex;
  align-items: center;
  gap: var(--sheet-tight);
}
.relationship label[data-relationship="enemy"] {
  color: var(--ui-error);
  accent-color: var(--ui-error);
}
.relationship label[data-relationship="friend"] {
  color: var(--ui-success);
  accent-color: var(--ui-success);
}
.relationship label[data-relationship="neutral"] {
  color: var(--ui-text-highlighted);
  accent-color: var(--ui-text-highlighted);
}
.sheet-name input,
.text-field,
.select-field select,
.select-field input {
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
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--spacing-small);
  margin-top: var(--spacing-small);
}
.defense-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-small);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
  padding: var(--sheet-tight) var(--spacing-small);
}
.sheet-split {
  display: grid;
  gap: var(--spacing-medium);
}
@media (min-width: 640px) {
  .sheet-split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .sheet-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
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
</style>
