<script setup lang="ts"></script>
<template>
  <Story title="Design system/Base/Badge">
    <template #default>
      <UApp
        ><div class="min-h-screen bg-default p-section text-default">
          <div class="flex flex-wrap gap-small">
            <UBadge color="success" variant="subtle">Active</UBadge
            ><UBadge color="neutral" variant="subtle">Inactive</UBadge
            ><UBadge color="error" variant="subtle">0 HP</UBadge>
          </div>
        </div></UApp
      >
    </template>
  </Story>
</template>
