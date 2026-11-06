<script setup lang="ts">
import { attributes, type Attribute, type PartyMember } from "./model";
import type { Character } from "../../src/modules/characters/sheet/types";
import type { NamedEntry } from "../../src/modules/characters/sheet/types";
import DieIcon from "../../src/shared/design-system/DieIcon.vue";

defineProps<{ party: readonly PartyMember[]; sheets: Record<string, Character> }>();
defineEmits<{ rollWeapon: [member: PartyMember, weapon: NamedEntry]; rollAttribute: [member: PartyMember, attribute: Attribute] }>();
</script>

<template>
  <ul v-if="party.length" class="grid gap-small pt-medium sm:grid-cols-2">
    <li
      v-for="member in party"
      :key="member.id"
      class="rounded-panel border border-default bg-default p-medium"
    >
      <div class="space-y-small">
        <div>
          <div class="flex flex-wrap items-center gap-small">
            <span class="font-semibold">{{ member.name }}</span>
            <UBadge v-if="member.hp.current === 0" color="error" variant="subtle">0 HP</UBadge>
          </div>
          <p class="text-label text-muted">{{ sheets[member.id]?.classes.map((item) => item.name).filter(Boolean).join(", ") || "No classes" }}</p>
        </div>
        <div class="attribute-row" aria-label="Attributes">
          <UTooltip v-for="attribute in attributes" :key="attribute" :text="`Roll a ${attribute} check`" :content="{ side: 'top' }">
            <button type="button" class="attribute-card" :aria-label="`Roll ${attribute} check for ${member.name}`" @click="$emit('rollAttribute', member, attribute)">
              <span>{{ attribute }}</span><DieIcon :sides="member.baseDice[attribute]" /><strong>d{{ member.baseDice[attribute] }}</strong>
            </button>
          </UTooltip>
        </div>
        <dl class="grid grid-cols-2 gap-small text-label tabular-nums">
          <div class="mini-resource">
            <dt>HP</dt>
            <dd>{{ member.hp.current }}<span> / {{ member.hp.max }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>MP</dt>
            <dd>{{ member.mp.current }}<span> / {{ member.mp.max }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>IP</dt>
            <dd>{{ member.ip.current }}<span> / {{ member.ip.max }}</span></dd>
          </div>
          <div class="mini-resource">
            <dt>Fabula Points</dt>
            <dd>{{ member.fabula }}</dd>
          </div>
          <div class="mini-resource">
            <dt>DEF</dt>
            <dd>{{ sheets[member.id]?.overrides.DEF ?? "—" }}</dd>
          </div>
          <div class="mini-resource">
            <dt>MAG DEF</dt>
            <dd>{{ sheets[member.id]?.overrides["MAG DEF"] ?? "—" }}</dd>
          </div>
        </dl>
        <dl class="space-y-small pt-small text-label">
          <div>
            <dt class="font-semibold text-muted">Weapons</dt>
            <dd v-if="!sheets[member.id]?.equipment.some((item) => item.itemType === 'weapon' && item.name)">None</dd>
            <dd v-for="weapon in sheets[member.id]?.equipment.filter((item) => item.itemType === 'weapon' && item.name)" :key="weapon.id" class="mt-small">
              <UTooltip :text="`Roll accuracy with ${weapon.name}`" :content="{ side: 'top' }">
                <button type="button" class="weapon-card" :aria-label="`Roll accuracy for ${member.name} using ${weapon.name}`" @click="$emit('rollWeapon', member, weapon)">
                  <span>{{ weapon.name }}</span>
                  <span v-if="weapon.weapon?.attributes.every(Boolean)" class="weapon-dice" aria-hidden="true">
                    <span v-for="(attribute, index) in weapon.weapon.attributes" :key="index" class="weapon-die">
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
  <p v-else class="text-muted">No active characters.</p>
</template>

<style scoped>
.attribute-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.25rem; }
.attribute-card { min-width: 0; display: grid; justify-items: center; gap: 0.125rem; padding: 0.25rem 0; border: 1px solid var(--ui-border); border-radius: var(--radius-panel); background: var(--ui-bg-muted); font-size: 0.65rem; cursor: pointer; }
.attribute-card:hover { border-color: var(--ui-primary); }
.attribute-card:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
.weapon-card { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--ui-border-accented); border-radius: var(--radius-panel); background: var(--ui-bg-muted); text-align: left; cursor: pointer; }
.weapon-dice, .weapon-die { display: inline-flex; align-items: center; gap: 0.125rem; }
.weapon-dice { gap: 0.25rem; }
.weapon-die { font-size: 0.625rem; font-weight: 700; }
.weapon-card:hover { border-color: var(--ui-primary); }
.weapon-card:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 2px; }
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
