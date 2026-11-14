<script setup lang="ts">
import type { Attribute, PartyCharacter } from "./types";
import AttributeRollButton from "./AttributeRollButton.vue";
import WeaponRollButton from "./WeaponRollButton.vue";
import ResourceBar from "../../shared/design-system/domain/ResourceBar.vue";
import InfoTooltip from "../../shared/design-system/base/InfoTooltip.vue";

const props = withDefaults(defineProps<{ member: PartyCharacter; canEdit?: boolean }>(), {
  canEdit: false,
});
const emit = defineEmits<{
  rollAttribute: [attribute: Attribute];
  rollWeapon: [weaponId: string];
  needsWeaponSetup: [weaponId: string];
  edit: [];
}>();

const attributes: readonly Attribute[] = ["DEX", "INS", "MIG", "WLP"];
</script>

<template>
  <li
    class="rounded-panel border border-default bg-default p-medium"
    data-testid="party-card"
    :data-character-id="member.id"
  >
    <div class="space-y-small">
      <div>
        <div class="flex flex-wrap items-center gap-small">
          <span class="font-semibold">{{ member.name }}</span>
          <UBadge v-if="member.level" color="neutral" variant="outline" size="sm">
            Lv {{ member.level }}
          </UBadge>
          <UBadge v-if="member.resources.hp === 0" color="error" variant="subtle">0 HP</UBadge>
          <UBadge
            v-for="tag in member.tags ?? []"
            :key="tag.name"
            :color="tag.color"
            variant="outline"
            size="sm"
          >
            {{ tag.name }}
          </UBadge>
          <UButton
            v-if="props.canEdit"
            class="ml-auto"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-pencil"
            aria-label="Edit character"
            data-testid="edit-character"
            @click="emit('edit')"
          />
        </div>
        <p class="text-label text-muted">{{ member.classes.join(", ") || "No classes" }}</p>
      </div>
      <div class="vital-resources">
        <div v-for="resource in ['hp', 'mp'] as const" :key="resource" class="vital-resource">
          <strong>{{ resource.toUpperCase() }}</strong>
          <ResourceBar
            :label="resource.toUpperCase()"
            :value="member.resources[resource]"
            :maximum="member.maxima[resource]"
            :color="resource"
          >
            <span :data-testid="resource === 'hp' ? 'party-hp' : undefined">
              {{ member.resources[resource] }} / {{ member.maxima[resource] }}
            </span>
          </ResourceBar>
        </div>
      </div>
      <div class="attribute-row" aria-label="Attributes">
        <AttributeRollButton
          v-for="attribute in attributes"
          :key="attribute"
          :attribute="attribute"
          :sides="member.baseDice[attribute]"
          :character-name="member.name"
          :can-roll="member.canRoll"
          @roll="emit('rollAttribute', attribute)"
        />
      </div>
      <dl class="grid grid-cols-2 gap-small text-label tabular-nums">
        <div class="mini-card">
          <div class="mini-resource">
            <dt>IP <InfoTooltip label="Inventory Points" text="Inventory Points" /></dt>
            <dd>
              {{ member.resources.ip }}<span> / {{ member.maxima.ip }}</span>
            </dd>
          </div>
          <div class="mini-resource">
            <dt>FP <InfoTooltip label="Fabula Points" text="Fabula Points" /></dt>
            <dd>{{ member.resources.fabula }}</dd>
          </div>
        </div>
        <div class="mini-card">
          <div class="mini-resource">
            <dt>DEF</dt>
            <dd>{{ member.defense ?? "—" }}</dd>
          </div>
          <div class="mini-resource">
            <dt>MAG DEF</dt>
            <dd>{{ member.magicDefense ?? "—" }}</dd>
          </div>
        </div>
      </dl>
      <dl class="space-y-small pt-small text-label">
        <div>
          <dt class="font-semibold text-muted">Weapons</dt>
          <dd v-if="!member.weapons.length">None</dd>
          <dd v-for="weapon in member.weapons" :key="weapon.id" class="mt-small">
            <WeaponRollButton
              :weapon="weapon"
              :base-dice="member.baseDice"
              :character-name="member.name"
              :can-roll="member.canRoll"
              :reach="weapon.reach ?? null"
              :damage-bonus="weapon.damageBonus ?? null"
              :damage-type="weapon.damageType ?? null"
              @roll="emit('rollWeapon', weapon.id)"
              @needs-setup="emit('needsWeaponSetup', weapon.id)"
            />
          </dd>
        </div>
      </dl>
    </div>
  </li>
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
}
.mini-card {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-tight);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
.mini-resource dt {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-tight);
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
