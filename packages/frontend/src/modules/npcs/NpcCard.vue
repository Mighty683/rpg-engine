<script setup lang="ts">
import { computed } from "vue";
import AttributeRollButton from "../game-table/AttributeRollButton.vue";
import WeaponRollButton from "../game-table/WeaponRollButton.vue";
import ViewDetailsButton from "../../shared/design-system/base/ViewDetailsButton.vue";
import VitalResourceSummary from "../../shared/design-system/domain/VitalResourceSummary.vue";
import type { Attribute, PartyWeapon } from "../game-table/types";
import type { Npc, NpcAttack } from "./types";

const props = withDefaults(
  defineProps<{
    npc: Npc;
    canRoll?: boolean;
    canEdit?: boolean;
    canView?: boolean;
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
</script>

<template>
  <article
    class="table-card flex h-full flex-col rounded-panel border border-default bg-default p-card-padding"
    :data-relationship="npc.relationship ?? 'neutral'"
    :data-testid="`npc-card-${npc.id}`"
  >
    <div class="flex flex-1 flex-col space-y-card-padding">
      <header>
        <div class="flex flex-wrap items-center gap-card-gap">
          <h3 class="npc-name text-card-heading font-semibold">{{ npc.name }}</h3>
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
          <ViewDetailsButton v-else-if="canView" :name="npc.name" @open="emit('edit', npc)" />
        </div>
      </header>

      <template v-if="redacted">
        <dl class="attribute-row" aria-label="Unknown attributes">
          <div v-for="attribute in attributes" :key="attribute" class="mini-resource">
            <dt>{{ attribute }}</dt>
            <dd>???</dd>
          </div>
        </dl>
        <dl class="grid grid-cols-2 gap-card-gap text-card-label">
          <div v-for="stat in ['HP', 'MP', 'DEF', 'MAG DEF']" :key="stat" class="mini-resource">
            <dt>{{ stat }}</dt>
            <dd>???</dd>
          </div>
        </dl>
        <p class="text-card-label text-muted">Attacks: ???</p>
      </template>
      <template v-else>
        <VitalResourceSummary :hp="npc.hp" :mp="npc.mp" hp-test-id="npc-hp" />
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

        <dl class="defense-card text-card-label tabular-nums">
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
          <h4 class="text-card-label font-semibold uppercase tracking-wide text-muted">Attacks</h4>
          <ul class="mt-card-detail space-y-card-detail">
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
            <li v-if="!npc.attacks.length" class="text-card-label text-muted">No attacks</li>
          </ul>
        </section>

        <section v-if="showNotes && npc.notes">
          <h4 class="text-card-label font-semibold uppercase tracking-wide text-muted">Notes</h4>
          <p
            class="mt-card-detail whitespace-pre-wrap text-card-label text-muted"
            data-testid="npc-notes"
          >
            {{ npc.notes }}
          </p>
        </section>
      </template>
    </div>
  </article>
</template>

<style scoped>
article[data-relationship="enemy"] {
  border-color: var(--color-relationship-enemy);
}
article[data-relationship="enemy"] .npc-name {
  color: var(--color-relationship-enemy);
}
article[data-relationship="friend"] {
  border-color: var(--color-relationship-friend);
}
article[data-relationship="friend"] .npc-name {
  color: var(--color-relationship-friend);
}
article[data-relationship="neutral"] .npc-name {
  color: var(--color-relationship-neutral);
}
.attribute-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--table-card-detail-gap);
}

.mini-resource {
  min-width: 0;
  display: grid;
  gap: var(--table-card-detail-gap);
  padding: var(--table-card-detail-gap);
  text-align: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
.defense-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--table-card-detail-gap);
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
  font-size: var(--table-card-label-size);
  font-weight: 700;
  letter-spacing: var(--table-card-label-tracking);
  text-transform: uppercase;
}
.mini-resource dd {
  align-self: end;
  color: var(--ui-text-highlighted);
  font-size: var(--table-card-body-size);
  font-weight: 700;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--radius-panel);
}
.mini-resource dd span {
  color: var(--ui-text-muted);
}
</style>
