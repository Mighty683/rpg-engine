<script setup lang="ts">
function initialState() {
  return { saving: false };
}
</script>
<template>
  <Story title="Design system/Base/Save status" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <p role="status" class="text-sm text-muted">
            {{ state.saving ? "Saving…" : "Saved automatically" }}
          </p>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"><HstCheckbox v-model="state.saving" title="Saving" /></template>
  </Story>
</template>
