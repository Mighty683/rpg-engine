<script setup lang="ts">
import { tr } from "../../shared/i18n";
import type { Attribute, PartyCharacter } from "./types";
import AttributeRollButton from "./AttributeRollButton.vue";
import WeaponRollButton from "./WeaponRollButton.vue";
import VitalResourceSummary from "../../shared/design-system/domain/VitalResourceSummary.vue";
import ViewDetailsButton from "../../shared/design-system/base/ViewDetailsButton.vue";
import InfoTooltip from "../../shared/design-system/base/InfoTooltip.vue";

const props = withDefaults(
  defineProps<{
    member: PartyCharacter;
    canEdit?: boolean;
    canView?: boolean;
    playerLabelId?: string;
  }>(),
  {
    canEdit: false,
  },
);
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
    class="table-card rounded-panel border border-default bg-default p-card-padding"
    data-testid="party-card"
    :data-character-id="member.id"
  >
    <div class="space-y-card-gap">
      <div>
        <p v-if="playerLabelId" :id="playerLabelId" class="text-card-label text-muted">
          {{ tr("ui.yourCharacter") }}
        </p>
        <div class="flex flex-wrap items-center gap-card-gap">
          <span class="character-name font-semibold">{{ member.name }}</span>
          <UBadge v-if="member.level" color="neutral" variant="outline" size="sm">
            {{ tr("ui.lvValue1", { value1: member.level }) }}
          </UBadge>
          <UBadge v-if="member.resources.hp === 0" color="error" variant="subtle">{{
            tr("ui.label0Hp")
          }}</UBadge>
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
            :aria-label="tr('ui.editCharacter')"
            data-testid="edit-character"
            @click="emit('edit')"
          />
          <ViewDetailsButton v-else-if="canView" :name="member.name" @open="emit('edit')" />
        </div>
        <p v-if="!$slots['class-progression']" class="text-card-label text-muted">
          {{ member.classes.join(", ") || tr("ui.noClasses") }}
        </p>
      </div>
      <VitalResourceSummary
        :hp="{ current: member.resources.hp, max: member.maxima.hp }"
        :mp="{ current: member.resources.mp, max: member.maxima.mp }"
        hp-test-id="party-hp"
      />
      <div class="attribute-row" :aria-label="tr('ui.attributes2')">
        <AttributeRollButton
          v-for="attribute in attributes"
          :key="attribute"
          :attribute="attribute"
          :sides="(member.currentDice ?? member.baseDice)[attribute]"
          :character-name="member.name"
          :can-roll="member.canRoll"
          @roll="emit('rollAttribute', attribute)"
        />
      </div>
      <dl class="party-stats grid grid-cols-2 gap-card-gap text-card-label tabular-nums">
        <div class="mini-card">
          <div class="mini-resource">
            <dt>
              {{ tr("ui.ip") }}
              <InfoTooltip :label="tr('ui.inventoryPoints')" :text="tr('ui.inventoryPoints')" />
            </dt>
            <dd>
              {{ member.resources.ip }}<span> / {{ member.maxima.ip }}</span>
            </dd>
          </div>
          <div class="mini-resource">
            <dt>
              {{ tr("ui.fp") }}
              <InfoTooltip :label="tr('ui.fabulaPoints')" :text="tr('ui.fabulaPoints')" />
            </dt>
            <dd>{{ member.resources.fabula }}</dd>
          </div>
        </div>
        <div class="mini-card">
          <div class="mini-resource">
            <dt>{{ tr("ui.def") }}</dt>
            <dd>{{ member.defense ?? "—" }}</dd>
          </div>
          <div class="mini-resource">
            <dt>{{ tr("ui.magDef") }}</dt>
            <dd>{{ member.magicDefense ?? "—" }}</dd>
          </div>
        </div>
      </dl>
      <slot name="class-progression" />
      <dl class="space-y-card-gap pt-card-gap text-card-label" data-testid="party-weapons">
        <div>
          <dt class="font-semibold text-muted">{{ tr("ui.weapons") }}</dt>
          <dd v-if="!member.weapons.length">{{ tr("ui.none") }}</dd>
          <dd v-for="weapon in member.weapons" :key="weapon.id" class="mt-card-gap">
            <WeaponRollButton
              :weapon="weapon"
              :base-dice="member.currentDice ?? member.baseDice"
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
      <slot name="equipment" />
      <slot name="actions" />
    </div>
  </li>
</template>

<style scoped>
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
}
.mini-card {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--table-card-detail-gap);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-panel);
  background: var(--ui-bg-muted);
}
.mini-resource dt {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--table-card-detail-gap);
  color: var(--ui-text-muted);
  font-size: var(--table-card-label-size);
  font-weight: 700;
  letter-spacing: var(--table-card-label-tracking);
  text-transform: uppercase;
}
.mini-resource dd {
  align-self: end;
  cursor: default;
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
.character-name {
  font-size: var(--table-card-title-size);
}
@container (max-width: 12rem) {
  .party-stats {
    grid-template-columns: 1fr;
  }
}
</style>
