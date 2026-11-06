<script setup lang="ts">
const locked = defineModel<boolean>({ required: true });
</script>

<template>
  <UButton
    data-testid="editing-lock"
    class="editing-lock"
    color="warning"
    variant="outline"
    :aria-pressed="locked"
    @click="locked = !locked"
    ><svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path v-if="locked" d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path v-else d="M8 10V7a4 4 0 0 1 7.5-2" />
      <path d="M12 14v3" /></svg
    >{{ locked ? "Unlock editing" : "Lock editing" }}</UButton
  >
</template>

<style scoped>
.editing-lock {
  align-self: stretch;
  justify-content: center;
}
.lock-icon {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
