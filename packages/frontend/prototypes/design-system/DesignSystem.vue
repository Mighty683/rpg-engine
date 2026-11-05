<script setup lang="ts">
import { ref } from "vue";
import DetailCard from "./DetailCard.vue";
import DieIcon from "./DieIcon.vue";
import ZenitIcon from "./ZenitIcon.vue";
import WeaponIcon from "./WeaponIcon.vue";
import EquipmentIcon from "./EquipmentIcon.vue";
const palettes = [
  {
    title: "Semantic colors",
    prefix: "--ui-",
    colors: [
      "primary",
      "success",
      "error",
      "warning",
      "info",
      "bg",
      "bg-muted",
      "bg-elevated",
      "bg-accented",
      "text",
      "text-muted",
      "text-highlighted",
      "border",
      "border-muted",
      "border-accented",
    ],
  },
  {
    title: "Primitive colors",
    prefix: "--value-",
    colors: [
      "white",
      "slate-50",
      "slate-100",
      "slate-200",
      "slate-300",
      "slate-400",
      "slate-500",
      "slate-600",
      "slate-700",
      "slate-800",
      "slate-900",
      "green-500",
      "green-400",
      "red-500",
      "red-400",
      "amber-500",
      "amber-400",
      "blue-500",
      "blue-400",
    ],
  },
];
const cardNotes = ref("A versatile adventurer.");
const spacing = ["small", "medium", "large", "field", "section", "page", "page-wide"];
</script>

<template>
  <UContainer class="space-y-page py-page">
    <div class="space-y-small">
      <h1 class="text-heading font-semibold">Design system</h1>
      <p class="text-muted">Primitive values feed semantic tokens used by the application.</p>
    </div>
    <section v-for="palette in palettes" :key="palette.prefix" class="space-y-large">
      <h2 class="text-section font-semibold">{{ palette.title }}</h2>
      <div class="grid grid-cols-2 gap-large sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="color in palette.colors" :key="color" class="space-y-small">
          <div
            class="h-16 rounded-panel border border-default"
            :style="{ backgroundColor: `var(${palette.prefix}${color})` }"
          />
          <code class="wrap-anywhere">{{ palette.prefix }}{{ color }}</code>
        </div>
      </div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Icons</h2>
      <p class="text-muted">Dice used for attribute tiers.</p>
      <div class="flex flex-wrap gap-section"><div v-for="sides in [6, 8, 10, 12]" :key="sides" class="flex items-center gap-small"><DieIcon :sides="sides" /><span>d{{ sides }}</span></div><div class="flex items-center gap-small"><ZenitIcon /><span>Zenit</span></div><div class="flex items-center gap-small"><WeaponIcon /><span>Weapon</span></div><div v-for="kind in (['armor', 'other', 'equipped'] as const)" :key="kind" class="flex items-center gap-small"><EquipmentIcon :kind="kind" /><span>{{ kind }}</span></div></div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Detail card</h2>
      <p class="text-muted">Select a card to edit details; click outside or press Escape to close.</p>
      <div class="max-w-sm"><DetailCard title="Wayfarer" :notes="cardNotes"><label class="block">Notes <input v-model="cardNotes" class="mt-small block w-full rounded-panel border border-default bg-default p-small" /></label></DetailCard></div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Spacing</h2>
      <div v-for="size in spacing" :key="size" class="flex items-center gap-large">
        <code>--spacing-{{ size }}</code>
        <div class="h-4 bg-primary" :style="{ width: `var(--spacing-${size})` }" />
      </div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Typography and radius</h2>
      <p class="text-heading font-semibold">Heading · sans</p>
      <p class="text-section font-semibold">Section · sans</p>
      <p class="text-body">Body · system sans</p>
      <div class="rounded-panel border border-default p-large">Panel radius</div>
    </section>
  </UContainer>
</template>
