<script setup lang="ts">
import ResourceBar from "../../../src/shared/design-system/ResourceBar.vue";

function initialState() {
  return { value: 28, maximum: 35, showValue: true };
}
</script>

<template>
  <Story title="Design system/Basic components/Resource bar" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <div class="grid max-w-md gap-medium">
            <ResourceBar label="HP" color="hp" :value="state.value" :maximum="state.maximum">
              <template v-if="state.showValue">{{ state.value }} / {{ state.maximum }}</template>
            </ResourceBar>
            <ResourceBar label="MP" color="mp" :value="state.value" :maximum="state.maximum">
              <template v-if="state.showValue">{{ state.value }} / {{ state.maximum }}</template>
            </ResourceBar>
          </div>
        </div></UApp
      >
    </template>
    <template #controls="{ state }">
      <HstSlider v-model="state.value" title="Current" :min="0" :max="100" />
      <HstSlider v-model="state.maximum" title="Maximum" :min="0" :max="100" />
      <HstCheckbox v-model="state.showValue" title="Show value inside" />
    </template>
  </Story>
</template>
