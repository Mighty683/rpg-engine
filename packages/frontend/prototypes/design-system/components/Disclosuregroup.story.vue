<script setup lang="ts">
function initialState() {
  return { expanded: true };
}
</script>
<template>
  <Story title="Design system/Base/Disclosure group" :init-state="initialState">
    <template #default="{ state }">
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <details :open="state.expanded" class="rounded-panel border border-default">
            <summary class="cursor-pointer p-medium font-semibold">
              Grouped items <UBadge color="neutral" variant="subtle">2 items</UBadge>
            </summary>
            <div class="p-medium">Group content</div>
          </details>
        </div></UApp
      >
    </template>
    <template #controls="{ state }"
      ><HstCheckbox v-model="state.expanded" title="Expanded"
    /></template>
  </Story>
</template>
