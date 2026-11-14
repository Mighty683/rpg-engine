<script setup lang="ts">
withDefaults(defineProps<{ sides: string | number }>(), { sides: 6 });
</script>

<template>
  <svg viewBox="0 0 32 32" class="die-icon" aria-hidden="true" focusable="false">
    <g
      :transform="`translate(16 16) scale(${Number(sides) === 6 ? 1.3 : Number(sides) === 8 ? 1.1667 : Number(sides) === 10 ? 1.0769 : 1} 1) translate(-16 -16)`"
    >
      <template v-if="Number(sides) === 4">
        <path d="M16 3 29 27H3Z M16 3v16M3 27l13-8 13 8" />
      </template>
      <template v-else-if="Number(sides) === 20">
        <path d="M16 2 28 9 28 23 16 30 4 23 4 9Z M4 9l12 5L28 9M4 23l12-9 12 9M16 14v16" />
      </template>
      <template v-else-if="Number(sides) === 6">
        <path d="M6 8 16 3 26 8v16l-10 5L6 24Z M6 8l10 5 10-5M16 13v16" />
      </template>
      <template v-else-if="Number(sides) === 8">
        <path d="M16 2 28 16 16 30 4 16Z M4 16h24M16 2v28" />
      </template>
      <template v-else-if="Number(sides) === 10">
        <path
          d="M16 2 27 10 29 21 16 30 3 21 5 10Z M16 2l-6 13 6 15 6-15Z M5 10l5 5-7 6M27 10l-5 5 7 6"
        />
      </template>
      <template v-else>
        <path
          d="M16 2 25 6 30 15 26 25 16 30 6 25 2 15 7 6Z M16 8l7 5-3 9h-8l-3-9ZM16 2v6M25 6l-2 7M30 15l-7-2M26 25l-6-3M16 30v-8M6 25l6-3M2 15l7-2M7 6l2 7"
        />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.die-icon {
  width: 1.75rem;
  height: 1.75rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--ui-primary);
  flex: none;
}
</style>
