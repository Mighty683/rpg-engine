<script setup lang="ts">
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
