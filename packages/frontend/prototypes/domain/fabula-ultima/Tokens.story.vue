<script setup lang="ts">
const colors = [
  "resource-hp",
  "resource-mp",
  "relationship-enemy",
  "relationship-friend",
  "relationship-neutral",
];
const dimensions = [
  "sheet-label-size",
  "sheet-meta-size",
  "sheet-tight",
  "dice-label-size",
  "dice-control-gap",
  "dice-control-padding",
];
</script>
<template>
  <Story title="Domain/Fabula Ultima/Tokens">
    <UApp
      ><div class="min-h-screen space-y-section bg-default p-section text-default">
        <h1 class="text-heading">Domain tokens</h1>
        <p class="text-small text-muted">
          RPG presentation aliases are independent of success/error feedback colors.
        </p>
        <div class="grid gap-medium sm:grid-cols-2">
          <div v-for="color in colors" :key="color" class="space-y-small">
            <div class="h-12 rounded-panel" :style="{ background: `var(--color-${color})` }" />
            <code>--color-{{ color }}</code>
          </div>
        </div>
        <ul class="space-y-small">
          <li v-for="token in dimensions" :key="token">
            <code>--{{ token }}</code>
          </li>
        </ul>
      </div></UApp
    >
  </Story>
</template>
