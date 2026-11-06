<script setup lang="ts">
import { computed } from "vue";
import type { Attribute, PartyCharacter } from "../../shared/api";
import DieIcon from "../../shared/design-system/DieIcon.vue";

const props = defineProps<{ party: readonly PartyCharacter[] }>();
const emit = defineEmits<{
  rollAttribute: [character: PartyCharacter, attribute: Attribute];
  rollWeapon: [character: PartyCharacter, weaponId: string];
  needsWeaponSetup: [character: PartyCharacter, weaponId: string];
}>();

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
const shown = computed(() => props.party);
</script>

<template>
  <ul v-if="shown.length" class="grid gap-small pt-medium sm:grid-cols-2" data-testid="party-list">
    <li
      v-for="member in shown"
      :key="member.id"
      class="rounded-panel border border-default bg-default p-medium"
      data-testid="party-card"
      :data-character-id="member.id"
    >
      <div class="space-y-small">
        <div>
          <div class="flex flex-wrap items-center gap-small">
            <span class="font-semibold">{{ member.name }}</span>
            <UBadge v-if="member.resources.hp === 0" color="error" variant="subtle">0 HP</UBadge>
          </div>
          <p class="text-label text-muted">{{ member.classes.join(", ") || "No classes" }}</p>
        </div>
        <div class="attribute-row" aria-label="Attributes">
          <UTooltip v-for="attribute in attributes" :key="attribute" :text="member.canRoll ? `Roll a ${attribute} check` : 'You cannot roll this character'" :content="{ side: 'top' }">
            <button
              type="button"
              class="attribute-card"
              :data-testid="`roll-attribute-${attribute}`"
              :aria-label="`Roll ${attribute} check for ${member.name}`"
              :disabled="!member.canRoll"
              @click="emit('rollAttribute', member, attribute)"
            >
              <span>{{ attribute }}</span><DieIcon :sides="member.baseDice[attribute]" /><strong>d{{ member.baseDice[attribute] }}</strong>
            </button>
          </UTooltip>
        </div>
        <dl class="grid grid-cols-2 gap-small text-label tabular-nums">
          <div class="mini-resource">
            <dt>HP</dt>
            <dd data-testid="party-hp">{{ member.resources.hp }}<span> / {{ member.maxima.hp }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>MP</dt>
            <dd>{{ member.resources.mp }}<span> / {{ member.maxima.mp }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>IP</dt>
            <dd>{{ member.resources.ip }}<span> / {{ member.maxima.ip }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>Fabula Points</dt>
            <dd>{{ member.resources.fabula }}</dd>
          </div>
          <div class="mini-resource">
            <dt>DEF</dt>
            <dd>{{ member.defense ?? "—" }}</dd>
          </div>
          <div class="mini-resource">
            <dt>MAG DEF</dt>
            <dd>{{ member.magicDefense ?? "—" }}</dd>
          </div>
        </dl>
        <dl class="space-y-small pt-small text-label">
          <div>
            <dt class="font-semibold text-muted">Weapons</dt>
            <dd v-if="!member.weapons.length">None</dd>
            <dd v-for="weapon in member.weapons" :key="weapon.id" class="mt-small">
              <UTooltip :text="weapon.ready ? `Roll accuracy with ${weapon.name}` : `Set both attributes and the accuracy bonus for ${weapon.name} on the character sheet`" :content="{ side: 'top' }">
                <button
                  type="button"
                  class="weapon-card"
                  :data-testid="`roll-weapon`"
                  :aria-label="`Roll accuracy for ${member.name} using ${weapon.name}`"
                  :disabled="!member.canRoll"
                  @click="weapon.ready ? emit('rollWeapon', member, weapon.id) : emit('needsWeaponSetup', member, weapon.id)"
                >
                  <span>{{ weapon.name }}</span>
                  <span v-if="weapon.accuracyDice.every(Boolean)" class="weapon-dice" aria-hidden="true">
                    <span v-for="(attribute, index) in weapon.accuracyDice" :key="index" class="weapon-die">
                      <template v-if="attribute"><DieIcon :sides="member.baseDice[attribute]" /><span>{{ attribute }}</span></template>
                    </span>
                  </span>
                </button>
              </UTooltip>
            </dd>
          </div>
        </dl>
      </div>
    </li>
  </ul>
  <p v-else class="text-muted" data-testid="party-empty">No active characters.</p>
</template>

<style scoped>
.attribute-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.25rem; }
.attribute-card { min-width: 0; display: grid; justify-items: center; gap: 0.125rem; padding: 0.25rem 0; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; cursor: pointer; }
.attribute-card:hover:not(:disabled) { border-color: var(--ui-primary); }
.attribute-card:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.attribute-card:disabled { opacity: 0.5; cursor: not-allowed; }
.weapon-card { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg-muted); text-align: left; cursor: pointer; }
.weapon-dice, .weapon-die { display: inline-flex; align-items: center; gap: 0.125rem; }
.weapon-dice { gap: 0.25rem; }
.weapon-die { font-size: 0.625rem; font-weight: 700; }
.weapon-card:hover:not(:disabled) { border-color: var(--ui-primary); }
.weapon-card:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.weapon-card:disabled { opacity: 0.6; cursor: not-allowed; }
:deep(.die-icon) { width: 1.1rem; height: 1.1rem; }
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
  cursor: default;
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
