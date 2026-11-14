<script setup lang="ts">
function initialState() {
  return { title: "Page heading" };
}
</script>
<template>
  <Story title="Design system/Base/Page header" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <header class="flex flex-wrap items-start justify-between gap-medium">
            <div>
              <h1 class="text-heading font-semibold">{{ state.title }}</h1>
              <p class="text-muted">Context and supporting information</p>
            </div>
            <div class="flex flex-wrap gap-small">
              <UButton>Primary action</UButton
              ><UButton color="neutral" variant="outline">Secondary action</UButton>
            </div>
          </header>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"><HstText v-model="state.title" title="Title" /></template>
  </Story>
</template>
