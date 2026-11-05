<script setup lang="ts">
const colors = [
  { name: "primary", token: "--ui-primary" },
  { name: "success", token: "--ui-success" },
  { name: "error", token: "--ui-error" },
  { name: "warning", token: "--ui-warning" },
  { name: "info", token: "--ui-info" },
  { name: "background", token: "--ui-bg" },
  { name: "elevated", token: "--ui-bg-elevated" },
  { name: "text", token: "--ui-text" },
  { name: "muted text", token: "--ui-text-muted" },
  { name: "border", token: "--ui-border" },
];
const spacing = ["small", "medium", "large", "field", "section", "page", "page-wide"];
const primitives = [
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
];
</script>

<template>
  <UContainer class="space-y-page py-page">
    <div class="space-y-small">
      <h1 class="text-heading font-semibold">Design system</h1>
      <p class="text-muted">Primitive values feed semantic tokens used by the application.</p>
    </div>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Semantic colors</h2>
      <div class="grid grid-cols-2 gap-large sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="color in colors" :key="color.token" class="space-y-small">
          <div
            class="h-16 rounded-panel border border-default"
            :style="{ backgroundColor: `var(${color.token})` }"
          />
          <p class="font-medium">{{ color.name }}</p>
          <code>{{ color.token }}</code>
        </div>
      </div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Spacing</h2>
      <div v-for="size in spacing" :key="size" class="flex items-center gap-large">
        <code>{{ size }}</code>
        <div class="h-4 bg-primary" :style="{ width: `var(--space-${size})` }" />
        <code>--space-{{ size }}</code>
      </div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Typography and radius</h2>
      <p class="text-heading font-semibold">Heading · sans</p>
      <p class="text-section font-semibold">Section · sans</p>
      <p class="text-body">Body · system sans</p>
      <div class="rounded-panel border border-default p-large">Panel radius</div>
    </section>
    <section class="space-y-large">
      <h2 class="text-section font-semibold">Primitive colors</h2>
      <div class="grid grid-cols-2 gap-large sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="color in primitives" :key="color" class="space-y-small">
          <div
            class="h-16 rounded-panel border border-default"
            :style="{ backgroundColor: `var(--value-${color})` }"
          />
          <code>--value-{{ color }}</code>
        </div>
      </div>
    </section>
  </UContainer>
</template>
