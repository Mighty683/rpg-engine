<script setup lang="ts">
import { computed, ref } from "vue";
import AttributeRollButton from "../game-table/AttributeRollButton.vue";
import WeaponRollButton from "../game-table/WeaponRollButton.vue";
import ResourceBar from "../../shared/design-system/domain/ResourceBar.vue";
import type { Attribute, PartyWeapon } from "../game-table/types";
import type { Npc, NpcAttack } from "./types";

const props = withDefaults(
  defineProps<{
    npc: Npc;
    canRoll?: boolean;
    canEdit?: boolean;
    redacted?: boolean;
    showNotes?: boolean;
  }>(),
  {
    canRoll: true,
    canEdit: true,
    showNotes: true,
  },
);
const emit = defineEmits<{
  edit: [npc: Npc];
  rollAttribute: [npc: Npc, attribute: Attribute];
  rollAttack: [npc: Npc, attack: NpcAttack];
}>();

function toWeapon(attack: NpcAttack): PartyWeapon {
  return {
    id: attack.id,
    name: attack.name,
    equipped: true,
    accuracyDice: attack.attributes,
    accuracyBonus: Math.floor(props.npc.level / 10),
    ready: true,
  };
}
const weapons = computed(() => props.npc.attacks.map(toWeapon));

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];

const attacksOpen = ref(false);

function attackSummary(npc: Npc): string {
  return npc.attacks.map((a) => `${a.name} (+${a.damageBonus} ${a.damageType})`).join(", ");
}
</script>

<template>
  <article
    class="flex h-full flex-col rounded-panel border border-default bg-default p-medium"
    :data-relationship="npc.relationship ?? 'neutral'"
    :data-testid="`npc-card-${npc.id}`"
  >
    <div class="flex flex-1 flex-col space-y-medium">
      <header>
        <div class="flex flex-wrap items-center gap-small">
          <h3 class="npc-name text-section font-semibold">{{ npc.name }}</h3>
          <UBadge v-if="!redacted" color="neutral" variant="outline" size="sm"
            >Lv {{ npc.level }}</UBadge
          >
          <UBadge v-if="!redacted && npc.hp.current === 0" color="error" variant="subtle"
            >0 HP</UBadge
          >
          <UButton
            v-if="canEdit"
            class="ml-auto"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-pencil"
            aria-label="Edit NPC"
            data-testid="edit-npc"
            @click="emit('edit', npc)"
          />
        </div>
      </header>

      <template v-if="redacted">
        <dl class="attribute-row" aria-label="Unknown attributes">
          <div v-for="attribute in attributes" :key="attribute" class="mini-resource">
            <dt>{{ attribute }}</dt>
            <dd>???</dd>
          </div>
        </dl>
        <dl class="grid grid-cols-2 gap-small text-label">
          <div v-for="stat in ['HP', 'MP', 'DEF', 'MAG DEF']" :key="stat" class="mini-resource">
            <dt>{{ stat }}</dt>
            <dd>???</dd>
          </div>
        </dl>
        <p class="text-label text-muted">Attacks: ???</p>
      </template>
      <template v-else>
        <div class="vital-resources">
          <div v-for="resource in ['hp', 'mp'] as const" :key="resource" class="vital-resource">
            <strong>{{ resource.toUpperCase() }}</strong>
            <ResourceBar
              :label="resource.toUpperCase()"
              :value="npc[resource].current"
              :maximum="npc[resource].max"
              :color="resource"
            >
              <span :data-testid="resource === 'hp' ? 'npc-hp' : undefined">
                {{ npc[resource].current }} / {{ npc[resource].max }}
              </span>
            </ResourceBar>
          </div>
        </div>
        <div class="attribute-row" aria-label="Attributes">
          <AttributeRollButton
            v-for="attribute in attributes"
            :key="attribute"
            :attribute="attribute"
            :sides="npc.baseDice[attribute]"
            :character-name="npc.name"
            :can-roll="canRoll"
            @roll="emit('rollAttribute', npc, attribute)"
          />
        </div>

        <dl class="defense-card text-label tabular-nums">
          <div class="mini-resource">
            <dt>DEF</dt>
            <dd>{{ npc.defense }}</dd>
          </div>
          <div class="mini-resource">
            <dt>MAG DEF</dt>
            <dd>{{ npc.magicDefense }}</dd>
          </div>
        </dl>

        <section>
          <UTooltip :text="attackSummary(npc) || 'No attacks'">
            <button
              type="button"
              class="flex w-full items-center justify-between text-label font-semibold uppercase tracking-wide text-muted"
              :aria-expanded="attacksOpen"
              data-testid="toggle-attacks"
              @click="attacksOpen = !attacksOpen"
            >
              Attacks
              <span aria-hidden="true">{{ attacksOpen ? "▴" : "▾" }}</span>
            </button>
          </UTooltip>
          <ul v-if="attacksOpen" class="mt-tight space-y-tight">
            <li v-for="(attack, index) in npc.attacks" :key="attack.id">
              <WeaponRollButton
                :weapon="weapons[index]!"
                :base-dice="npc.baseDice"
                :character-name="npc.name"
                :can-roll="canRoll"
                :reach="attack.range"
                :damage-bonus="attack.damageBonus"
                :damage-type="attack.damageType"
                @roll="emit('rollAttack', npc, attack)"
              />
            </li>
            <li v-if="!npc.attacks.length" class="text-label text-muted">No attacks</li>
          </ul>
        </section>

        <section v-if="showNotes && npc.notes">
          <h4 class="text-label font-semibold uppercase tracking-wide text-muted">Notes</h4>
          <p class="mt-tight whitespace-pre-wrap text-label text-muted" data-testid="npc-notes">
            {{ npc.notes }}
          </p>
        </section>
      </template>
    </div>
  </article>
</template>

<style scoped>
.vital-resources {
  display: grid;
  gap: var(--spacing-small);
}
.vital-resource {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  align-items: center;
  gap: var(--spacing-small);
  font-size: var(--text-label);
  font-variant-numeric: tabular-nums;
}
.vital-resource strong {
  color: var(--ui-text-muted);
}
article[data-relationship="enemy"] {
  border-color: var(--ui-error);
}
article[data-relationship="enemy"] .npc-name {
  color: var(--ui-error);
}
article[data-relationship="friend"] {
  border-color: var(--ui-success);
}
article[data-relationship="friend"] .npc-name {
  color: var(--ui-success);
}
article[data-relationship="neutral"] .npc-name {
  color: var(--ui-text-highlighted);
}
.attribute-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
}

.mini-resource {
  min-width: 0;
  display: grid;
  gap: 0.125rem;
  padding: 0.25rem;
  text-align: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
.defense-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-tight);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
.defense-card .mini-resource {
  border: 0;
  background: transparent;
}
.mini-resource dt {
  color: var(--ui-text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.mini-resource dd {
  align-self: end;
  color: var(--ui-text-highlighted);
  font-size: 0.875rem;
  font-weight: 700;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
}
.mini-resource dd span {
  color: var(--ui-text-muted);
}
</style>
