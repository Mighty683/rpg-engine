<script setup lang="ts">
import InteractiveCard from "../../../src/shared/design-system/base/InteractiveCard.vue";

function initialState() {
  return { title: "Wayfarer", description: "Secondary information" };
}
</script>
<template>
  <Story title="Design system/Base/Interactive card" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <InteractiveCard to="/"
            ><span
              ><strong>{{ state.title }}</strong
              ><br /><span class="text-muted">{{ state.description }}</span></span
            ></InteractiveCard
          >
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstText v-model="state.title" title="Title" /><HstText
        v-model="state.description"
        title="Description"
    /></template>
  </Story>
</template>
