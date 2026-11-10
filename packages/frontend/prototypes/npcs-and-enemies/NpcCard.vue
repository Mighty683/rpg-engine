<script setup lang="ts">
import { computed, ref } from "vue";
import AttributeRollButton from "../../src/modules/game-table/AttributeRollButton.vue";
import WeaponRollButton from "../../src/modules/game-table/WeaponRollButton.vue";
import type { Attribute, PartyWeapon } from "../../src/modules/game-table/types";
import type { Npc, NpcAttack } from "./fixtures";

const props = withDefaults(defineProps<{ npc: Npc; canRoll?: boolean; canEdit?: boolean }>(), {
  canRoll: true,
  canEdit: true,
});
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
    accuracyDice: attack.attributes as [Attribute, Attribute],
    accuracyBonus: Math.floor(props.npc.level / 10),
    ready: true,
  };
}
const weapons = computed(() => props.npc.attacks.map(toWeapon));

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];

const rankLabels: Record<string, string> = {
  Soldier: "Soldier",
  Elite: "Elite (×2)",
  Champion: "Champion",
};

const attacksOpen = ref(false);
const abilitiesOpen = ref(false);

function attackSummary(npc: Npc): string {
  return npc.attacks
    .map((a) => `${a.name} (high roll +${a.damageBonus} ${a.damageType})`)
    .join(", ");
}
function abilitySummary(npc: Npc): string {
  return npc.abilities.map((a) => a.name).join(", ");
}
</script>

<template>
  <article
    class="flex h-full flex-col rounded-panel border border-default bg-default p-medium"
    :data-testid="`npc-card-${npc.id}`"
  >
    <div class="flex flex-1 flex-col space-y-medium">
      <header>
        <div class="flex flex-wrap items-center gap-small">
          <h3 class="text-section font-semibold">{{ npc.name }}</h3>
          <UBadge color="neutral" variant="outline" size="sm">Lv {{ npc.level }}</UBadge>
          <UBadge color="warning" variant="subtle">{{ rankLabels[npc.rank] }}</UBadge>
          <UBadge v-if="npc.hp.current === 0" color="error" variant="subtle">0 HP</UBadge>
          <UBadge v-else-if="npc.hp.current <= npc.crisis" color="warning" variant="subtle">
            Crisis
          </UBadge>
          <UBadge
            v-for="tag in npc.tags"
            :key="tag.name"
            :color="tag.color"
            variant="outline"
            size="sm"
          >
            {{ tag.name }}
          </UBadge>
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
        <p class="mt-tight text-body">Accuracy +{{ Math.floor(npc.level / 10) }}</p>
      </header>

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

      <dl class="grid grid-cols-3 gap-small text-label tabular-nums">
        <div class="mini-resource">
          <dt>HP</dt>
          <dd data-testid="npc-hp">
            {{ npc.hp.current }}<span> / {{ npc.hp.max }}</span>
          </dd>
        </div>
        <div class="mini-resource">
          <dt>MP</dt>
          <dd>
            {{ npc.mp.current }}<span> / {{ npc.mp.max }}</span>
          </dd>
        </div>
        <div class="mini-resource">
          <dt>Crisis</dt>
          <dd>{{ npc.crisis }}</dd>
        </div>
        <div class="mini-resource">
          <dt>DEF</dt>
          <dd>{{ npc.defense }}</dd>
        </div>
        <div class="mini-resource">
          <dt>MAG DEF</dt>
          <dd>{{ npc.magicDefense }}</dd>
        </div>
        <div class="mini-resource">
          <dt>INIT</dt>
          <dd>{{ npc.initiative }}</dd>
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

      <section v-if="npc.abilities.length">
        <UTooltip :text="abilitySummary(npc)">
          <button
            type="button"
            class="flex w-full items-center justify-between text-label font-semibold uppercase tracking-wide text-muted"
            :aria-expanded="abilitiesOpen"
            data-testid="toggle-abilities"
            @click="abilitiesOpen = !abilitiesOpen"
          >
            Abilities
            <span aria-hidden="true">{{ abilitiesOpen ? "▴" : "▾" }}</span>
          </button>
        </UTooltip>
        <ul v-if="abilitiesOpen" class="mt-tight space-y-tight">
          <li v-for="ability in npc.abilities" :key="ability.id">
            <span class="font-semibold">{{ ability.name }}</span>
            <span class="text-label text-muted"> — {{ ability.description }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="npc.vulnerabilities.length || npc.resistances.length || npc.immunities.length"
        class="flex flex-wrap gap-small"
      >
        <UBadge v-for="v in npc.vulnerabilities" :key="`v-${v}`" color="error" variant="subtle">
          Vulnerable: {{ v }}
        </UBadge>
        <UBadge v-for="r in npc.resistances" :key="`r-${r}`" color="info" variant="subtle">
          Resistant: {{ r }}
        </UBadge>
        <UBadge v-for="i in npc.immunities" :key="`i-${i}`" color="success" variant="subtle">
          Immune: {{ i }}
        </UBadge>
      </section>

      <p v-if="npc.notes" class="mt-auto text-label text-muted italic">{{ npc.notes }}</p>
    </div>
  </article>
</template>

<style scoped>
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
